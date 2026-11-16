# Helo Windows helper.
# One long-lived process started by the app. It reads JSON commands from stdin
# (one per line) and writes JSON events and replies to stdout (one per line).
# It exits when stdin closes, so it never outlives the app.
#
# Uses only what ships with Windows 10: PowerShell 5.1, WinRT projections and
# the .NET Framework C# compiler behind Add-Type.

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false

$csharp = @'
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using Microsoft.Win32;

namespace HeloHelper {
  public static class Input {
    static readonly BlockingCollection<string> Lines = new BlockingCollection<string>();
    public static void Start() {
      Thread t = new Thread(delegate () {
        System.IO.StreamReader reader = new System.IO.StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false));
        string line;
        while ((line = reader.ReadLine()) != null) Lines.Add(line);
        Lines.Add("__EOF__");
      });
      t.IsBackground = true;
      t.Start();
    }
    public static string Take(int timeoutMs) {
      string s;
      return Lines.TryTake(out s, timeoutMs) ? s : null;
    }
  }

  [ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioEndpointVolume {
    int RegisterControlChangeNotify(IntPtr p);
    int UnregisterControlChangeNotify(IntPtr p);
    int GetChannelCount(out uint c);
    int SetMasterVolumeLevel(float db, ref Guid ctx);
    int SetMasterVolumeLevelScalar(float level, ref Guid ctx);
    int GetMasterVolumeLevel(out float db);
    int GetMasterVolumeLevelScalar(out float level);
    int SetChannelVolumeLevel(uint ch, float db, ref Guid ctx);
    int SetChannelVolumeLevelScalar(uint ch, float level, ref Guid ctx);
    int GetChannelVolumeLevel(uint ch, out float db);
    int GetChannelVolumeLevelScalar(uint ch, out float level);
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid ctx);
    int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
  }

  [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice {
    int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
  }

  [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr devices);
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
  }

  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
  class MMDeviceEnumerator { }

  public static class Audio {
    static IAudioEndpointVolume cached;
    static DateTime cachedAt = DateTime.MinValue;

    static IAudioEndpointVolume Endpoint() {
      if (cached != null && (DateTime.UtcNow - cachedAt).TotalSeconds < 3) return cached;
      cached = null;
      IMMDeviceEnumerator en = (IMMDeviceEnumerator)(new MMDeviceEnumerator());
      IMMDevice dev;
      if (en.GetDefaultAudioEndpoint(0, 1, out dev) != 0 || dev == null) return null;
      Guid iid = typeof(IAudioEndpointVolume).GUID;
      object o;
      if (dev.Activate(ref iid, 23, IntPtr.Zero, out o) != 0) return null;
      cached = (IAudioEndpointVolume)o;
      cachedAt = DateTime.UtcNow;
      return cached;
    }

    // "level|muted", level 0..100, or "" when there is no output device.
    public static string Get() {
      try {
        IAudioEndpointVolume v = Endpoint();
        if (v == null) return "";
        float level; bool mute;
        v.GetMasterVolumeLevelScalar(out level);
        v.GetMute(out mute);
        return ((int)Math.Round(level * 100)).ToString() + "|" + (mute ? "1" : "0");
      } catch { cached = null; return ""; }
    }

    public static bool Set(int percent) {
      IAudioEndpointVolume v = Endpoint();
      if (v == null) return false;
      Guid ctx = Guid.Empty;
      return v.SetMasterVolumeLevelScalar(Math.Max(0, Math.Min(100, percent)) / 100f, ref ctx) == 0;
    }

    public static bool Mute(bool on) {
      IAudioEndpointVolume v = Endpoint();
      if (v == null) return false;
      Guid ctx = Guid.Empty;
      return v.SetMute(on, ref ctx) == 0;
    }
  }

  public static class Privacy {
    // Registry keys of apps that are using the capability right now
    // ("microphone" or "webcam"), joined with "\n".
    public static string InUse(string capability) {
      List<string> found = new List<string>();
      string path = @"Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\" + capability;
      using (RegistryKey root = Registry.CurrentUser.OpenSubKey(path)) {
        if (root == null) return "";
        Scan(root, found);
        using (RegistryKey np = root.OpenSubKey("NonPackaged")) { if (np != null) Scan(np, found); }
      }
      return string.Join("\n", found.ToArray());
    }

    static void Scan(RegistryKey key, List<string> found) {
      foreach (string name in key.GetSubKeyNames()) {
        if (name == "NonPackaged") continue;
        using (RegistryKey sub = key.OpenSubKey(name)) {
          if (sub == null) continue;
          object start = sub.GetValue("LastUsedTimeStart");
          object stop = sub.GetValue("LastUsedTimeStop");
          if (start is long && stop is long && (long)stop == 0 && (long)start > 0) found.Add(name);
        }
      }
    }
  }

  public static class Native {
    [StructLayout(LayoutKind.Sequential)]
    struct SYSTEM_POWER_STATUS {
      public byte ACLineStatus; public byte BatteryFlag; public byte BatteryLifePercent;
      public byte SystemStatusFlag; public int BatteryLifeTime; public int BatteryFullLifeTime;
    }
    [DllImport("kernel32.dll")] static extern bool GetSystemPowerStatus(out SYSTEM_POWER_STATUS s);
    [DllImport("user32.dll")] static extern uint GetClipboardSequenceNumber();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern uint RegisterClipboardFormat(string name);
    [DllImport("user32.dll")] static extern bool IsClipboardFormatAvailable(uint format);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);

    // "ac|flag|percent": ac 0/1/255, flag 128 = no battery, 8 = charging, percent 255 = unknown.
    public static string Power() {
      SYSTEM_POWER_STATUS s;
      if (!GetSystemPowerStatus(out s)) return "";
      return s.ACLineStatus + "|" + s.BatteryFlag + "|" + s.BatteryLifePercent;
    }

    public static uint ClipboardSequence() { return GetClipboardSequenceNumber(); }

    static uint excludeFormat, ignoreFormat;
    // True when the copying app asked clipboard monitors to skip this content (password managers do).
    public static bool ClipboardExcluded() {
      if (excludeFormat == 0) excludeFormat = RegisterClipboardFormat("ExcludeClipboardContentFromMonitorProcessing");
      if (ignoreFormat == 0) ignoreFormat = RegisterClipboardFormat("Clipboard Viewer Ignore");
      return IsClipboardFormatAvailable(excludeFormat) || IsClipboardFormatAvailable(ignoreFormat);
    }

    public static uint ForegroundPid() {
      uint pid;
      GetWindowThreadProcessId(GetForegroundWindow(), out pid);
      return pid;
    }

    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);

    public static long ForegroundWindow() { return GetForegroundWindow().ToInt64(); }

    [StructLayout(LayoutKind.Sequential)] struct FsRect { public int L, T, R, B; }
    [StructLayout(LayoutKind.Sequential)] struct FsMonitorInfo { public int Size; public FsRect Monitor; public FsRect Work; public uint Flags; }
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out FsRect r);
    [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h, uint flags);
    [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr m, ref FsMonitorInfo mi);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder sb, int max);
    [DllImport("user32.dll", EntryPoint = "GetWindowLong")] static extern int FsGetWindowLong(IntPtr h, int index);

    // "1|left|top" when the window in front covers its whole monitor and has no
    // title bar (a game or fullscreen video), else "0|0|0". Left/top identify the monitor.
    // A maximised window keeps its title-bar style, so it does not count.
    public static string ForegroundFullscreen() {
      IntPtr w = GetForegroundWindow();
      if (w == IntPtr.Zero) return "0|0|0";
      StringBuilder sb = new StringBuilder(64);
      GetClassName(w, sb, 64);
      string c = sb.ToString();
      if (c == "Progman" || c == "WorkerW" || c == "Shell_TrayWnd") return "0|0|0";
      if ((FsGetWindowLong(w, -16) & 0x00C00000) == 0x00C00000) return "0|0|0";
      FsRect r;
      if (!GetWindowRect(w, out r)) return "0|0|0";
      FsMonitorInfo mi = new FsMonitorInfo();
      mi.Size = Marshal.SizeOf(typeof(FsMonitorInfo));
      if (!GetMonitorInfo(MonitorFromWindow(w, 2), ref mi)) return "0|0|0";
      bool covers = r.L <= mi.Monitor.L && r.T <= mi.Monitor.T && r.R >= mi.Monitor.R && r.B >= mi.Monitor.B;
      return (covers ? "1" : "0") + "|" + mi.Monitor.L + "|" + mi.Monitor.T;
    }

    [StructLayout(LayoutKind.Sequential)] struct POINT { public int X; public int Y; }
    [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(POINT p);
    [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT p);
    [DllImport("user32.dll")] static extern int GetSystemMetrics(int index);
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h, uint flags);
    [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public MOUSEINPUT mi; }
    [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint n, INPUT[] inputs, int size);

    // Process id owning the top-level window under a screen point (physical pixels).
    public static uint PidAt(int x, int y) {
      POINT p; p.X = x; p.Y = y;
      IntPtr h = WindowFromPoint(p);
      if (h == IntPtr.Zero) return 0;
      h = GetAncestor(h, 2);
      uint pid;
      GetWindowThreadProcessId(h, out pid);
      return pid;
    }

    public static string CursorPos() { POINT p; GetCursorPos(out p); return p.X + "|" + p.Y; }

    // Moves the pointer through the input stream (so hooks see it), in physical pixels.
    public static bool MoveCursor(int x, int y) {
      int vx = GetSystemMetrics(76), vy = GetSystemMetrics(77), vw = GetSystemMetrics(78), vh = GetSystemMetrics(79);
      INPUT[] input = new INPUT[1];
      input[0].type = 0;
      input[0].mi.dx = (int)Math.Round((x - vx) * 65535.0 / Math.Max(1, vw - 1));
      input[0].mi.dy = (int)Math.Round((y - vy) * 65535.0 / Math.Max(1, vh - 1));
      input[0].mi.dwFlags = 0x0001 | 0x8000 | 0x4000; // MOVE | ABSOLUTE | VIRTUALDESK
      return SendInput(1, input, Marshal.SizeOf(typeof(INPUT))) == 1;
    }

    // Gives focus back to a window the user was in before typing in the island.
    // A short Alt tap lifts Windows' foreground lock for this call (it lands on
    // the island, which is still the foreground window at that moment).
    public static bool Activate(long handle) {
      IntPtr w = new IntPtr(handle);
      if (handle == 0 || !IsWindow(w) || !IsWindowVisible(w)) return false;
      if (GetForegroundWindow() == w) return true;
      keybd_event(0x12, 0, 0, UIntPtr.Zero);
      keybd_event(0x12, 0, 2, UIntPtr.Zero);
      return SetForegroundWindow(w);
    }
  }

  public static class Ddc {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct PHYSICAL_MONITOR { public IntPtr Handle; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string Description; }
    delegate bool MonitorEnumProc(IntPtr hMon, IntPtr hdc, IntPtr rect, IntPtr data);
    [DllImport("user32.dll")] static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr clip, MonitorEnumProc proc, IntPtr data);
    [DllImport("dxva2.dll")] static extern bool GetNumberOfPhysicalMonitorsFromHMONITOR(IntPtr hMon, out uint count);
    [DllImport("dxva2.dll")] static extern bool GetPhysicalMonitorsFromHMONITOR(IntPtr hMon, uint count, [Out] PHYSICAL_MONITOR[] monitors);
    [DllImport("dxva2.dll")] static extern bool DestroyPhysicalMonitors(uint count, PHYSICAL_MONITOR[] monitors);
    [DllImport("dxva2.dll")] static extern bool GetVCPFeatureAndVCPFeatureReply(IntPtr h, byte code, IntPtr type, out uint current, out uint maximum);
    [DllImport("dxva2.dll")] static extern bool SetVCPFeature(IntPtr h, byte code, uint value);

    static List<PHYSICAL_MONITOR[]> Open() {
      List<PHYSICAL_MONITOR[]> all = new List<PHYSICAL_MONITOR[]>();
      EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, delegate (IntPtr hMon, IntPtr hdc, IntPtr rect, IntPtr data) {
        uint n;
        if (GetNumberOfPhysicalMonitorsFromHMONITOR(hMon, out n) && n > 0) {
          PHYSICAL_MONITOR[] arr = new PHYSICAL_MONITOR[n];
          if (GetPhysicalMonitorsFromHMONITOR(hMon, n, arr)) all.Add(arr);
        }
        return true;
      }, IntPtr.Zero);
      return all;
    }

    static void Close(List<PHYSICAL_MONITOR[]> all) {
      foreach (PHYSICAL_MONITOR[] arr in all) DestroyPhysicalMonitors((uint)arr.Length, arr);
    }

    // One line per physical monitor: "index|description|current|max", current -1 when DDC/CI does not answer.
    public static string List(byte code) {
      List<PHYSICAL_MONITOR[]> all = Open();
      StringBuilder sb = new StringBuilder();
      int i = 0;
      try {
        foreach (PHYSICAL_MONITOR[] arr in all) {
          foreach (PHYSICAL_MONITOR m in arr) {
            uint cur, max;
            bool ok = GetVCPFeatureAndVCPFeatureReply(m.Handle, code, IntPtr.Zero, out cur, out max);
            if (sb.Length > 0) sb.Append('\n');
            sb.Append(i).Append('|').Append((m.Description ?? "").Replace("|", " ")).Append('|')
              .Append(ok ? (long)cur : -1).Append('|').Append(ok ? (long)max : -1);
            i++;
          }
        }
      } finally { Close(all); }
      return sb.ToString();
    }

    public static bool Set(int index, byte code, uint value) {
      List<PHYSICAL_MONITOR[]> all = Open();
      int i = 0;
      try {
        foreach (PHYSICAL_MONITOR[] arr in all) {
          foreach (PHYSICAL_MONITOR m in arr) {
            if (i == index) return SetVCPFeature(m.Handle, code, value);
            i++;
          }
        }
      } finally { Close(all); }
      return false;
    }
  }
  public static class Procs {
    delegate bool EnumWindowsProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder sb, int max);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
    [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int index);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int attr, out int value, int size);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct PROCESSENTRY32 {
      public uint dwSize; public uint cntUsage; public uint th32ProcessID; public IntPtr th32DefaultHeapID;
      public uint th32ModuleID; public uint cntThreads; public uint th32ParentProcessID; public int pcPriClassBase;
      public uint dwFlags; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szExeFile;
    }
    [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint pid);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool Process32FirstW(IntPtr snap, ref PROCESSENTRY32 e);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool Process32NextW(IntPtr snap, ref PROCESSENTRY32 e);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);

    // One "pid|process|title" line per process that has a visible app window.
    public static string Windows() {
      Dictionary<uint, string> seen = new Dictionary<uint, string>();
      List<string> lines = new List<string>();
      EnumWindows(delegate (IntPtr h, IntPtr l) {
        if (!IsWindowVisible(h) || GetWindow(h, 4) != IntPtr.Zero) return true;     // skip owned windows
        if ((GetWindowLong(h, -20) & 0x80) != 0) return true;                       // WS_EX_TOOLWINDOW
        int cloaked;
        if (DwmGetWindowAttribute(h, 14, out cloaked, 4) == 0 && cloaked != 0) return true;
        StringBuilder sb = new StringBuilder(256);
        if (GetWindowText(h, sb, 256) == 0) return true;
        uint pid;
        GetWindowThreadProcessId(h, out pid);
        if (pid == 0 || seen.ContainsKey(pid)) return true;
        string name = "";
        try { name = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName; } catch { return true; }
        seen[pid] = name;
        lines.Add(pid + "|" + name.Replace("|", " ") + "|" + sb.ToString().Replace("|", " ").Replace("\n", " "));
        return true;
      }, IntPtr.Zero);
      return string.Join("\n", lines.ToArray());
    }

    // "alive|cpuMs|processes|startTicks" for a process and all of its descendants.
    public static string TreeCpu(int root) {
      long start = 0;
      try { start = System.Diagnostics.Process.GetProcessById(root).StartTime.ToUniversalTime().Ticks; }
      catch (ArgumentException) { return "0|0|0|0"; }
      catch { }
      Dictionary<uint, List<uint>> children = new Dictionary<uint, List<uint>>();
      IntPtr snap = CreateToolhelp32Snapshot(2, 0);
      if (snap != new IntPtr(-1)) {
        try {
          PROCESSENTRY32 e = new PROCESSENTRY32();
          e.dwSize = (uint)Marshal.SizeOf(typeof(PROCESSENTRY32));
          if (Process32FirstW(snap, ref e)) {
            do {
              List<uint> list;
              if (!children.TryGetValue(e.th32ParentProcessID, out list)) { list = new List<uint>(); children[e.th32ParentProcessID] = list; }
              list.Add(e.th32ProcessID);
            } while (Process32NextW(snap, ref e));
          }
        } finally { CloseHandle(snap); }
      }
      double cpu = 0;
      int count = 0;
      Queue<uint> queue = new Queue<uint>();
      HashSet<uint> visited = new HashSet<uint>();
      queue.Enqueue((uint)root);
      while (queue.Count > 0 && count < 500) {
        uint pid = queue.Dequeue();
        if (!visited.Add(pid)) continue;
        try {
          System.Diagnostics.Process p = System.Diagnostics.Process.GetProcessById((int)pid);
          cpu += p.TotalProcessorTime.TotalMilliseconds;
          count++;
        } catch { }
        List<uint> kids;
        if (pid != 0 && children.TryGetValue(pid, out kids)) foreach (uint k in kids) if (k != pid) queue.Enqueue(k);
      }
      return "1|" + ((long)cpu) + "|" + count + "|" + start;
    }
  }
}
'@

function Send($obj) {
  [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress -Depth 6))
  [Console]::Out.Flush()
}

try {
  Add-Type -TypeDefinition $csharp -Language CSharp
} catch {
  Send @{ type = 'fatal'; message = "Could not compile the helper: $($_.Exception.Message)" }
  exit 1
}
[HeloHelper.Input]::Start()

# ---- WinRT: system media transport controls --------------------------------
$media = $null
$asTask = $null
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
      $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    })[0]
  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
  $null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
} catch {
  Send @{ type = 'error'; where = 'media-init'; message = $_.Exception.Message }
}

function Await($op, [Type]$resultType, [int]$timeoutMs = 3000) {
  $task = $asTask.MakeGenericMethod($resultType).Invoke($null, @($op))
  if (-not $task.Wait($timeoutMs)) { throw 'timed out' }
  $task.Result
}

function Get-MediaManager {
  if ($null -eq $script:media -and $null -ne $asTask) {
    $script:media = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
  }
  $script:media
}

function Get-Session {
  $mgr = Get-MediaManager
  if ($null -eq $mgr) { return $null }
  $mgr.GetCurrentSession()
}

$lastMediaJson = ''
$lastTrackKey = ''
$lastArt = $null

function Read-Thumbnail($props) {
  if ($null -eq $props.Thumbnail) { return $null }
  $stream = Await ($props.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
  try {
    if ($stream.Size -gt 4MB) { return $null }
    $net = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
    $ms = New-Object System.IO.MemoryStream
    $net.CopyTo($ms)
    $type = $stream.ContentType
    if (-not $type -or $type -notmatch '^image/(png|jpeg|jpg|gif|bmp|webp)$') { $type = 'image/png' }
    return "data:$type;base64," + [Convert]::ToBase64String($ms.ToArray())
  } finally {
    $stream.Dispose()
  }
}

function Poll-Media([bool]$force) {
  $session = Get-Session
  if ($null -eq $session) {
    $json = '{"type":"media","session":null}'
    if ($json -ne $script:lastMediaJson -or $force) { $script:lastMediaJson = $json; [Console]::Out.WriteLine($json); [Console]::Out.Flush() }
    $script:lastTrackKey = ''
    return
  }
  $props = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
  $info = $session.GetPlaybackInfo()
  $tl = $session.GetTimelineProperties()
  $key = "$($session.SourceAppUserModelId)|$($props.Title)|$($props.Artist)|$($props.AlbumTitle)"
  $artChanged = $false
  if ($key -ne $script:lastTrackKey) {
    $script:lastTrackKey = $key
    $script:lastArt = $null
    try { $script:lastArt = Read-Thumbnail $props } catch { $script:lastArt = $null }
    $artChanged = $true
  }
  $c = $info.Controls
  $state = [ordered]@{
    type = 'media'
    session = [ordered]@{
      app = [string]$session.SourceAppUserModelId
      title = [string]$props.Title
      artist = [string]$props.Artist
      album = [string]$props.AlbumTitle
      status = [string]$info.PlaybackStatus
      canPlay = [bool]$c.IsPlayEnabled
      canPause = [bool]$c.IsPauseEnabled
      canNext = [bool]$c.IsNextEnabled
      canPrevious = [bool]$c.IsPreviousEnabled
      canSeek = [bool]$c.IsPlaybackPositionEnabled
      positionMs = [math]::Round($tl.Position.TotalMilliseconds)
      startMs = [math]::Round($tl.StartTime.TotalMilliseconds)
      endMs = [math]::Round($tl.EndTime.TotalMilliseconds)
      updatedAt = $tl.LastUpdatedTime.ToUnixTimeMilliseconds()
    }
  }
  $json = $state | ConvertTo-Json -Compress -Depth 4
  if ($json -ne $script:lastMediaJson -or $artChanged -or $force) {
    $script:lastMediaJson = $json
    Send $state
    if ($artChanged) { Send @{ type = 'art'; key = $key; art = $script:lastArt } }
  }
}

function Invoke-Media($action, $value) {
  $session = Get-Session
  if ($null -eq $session) { return $false }
  switch ($action) {
    'toggle' { return Await ($session.TryTogglePlayPauseAsync()) ([bool]) }
    'play' { return Await ($session.TryPlayAsync()) ([bool]) }
    'pause' { return Await ($session.TryPauseAsync()) ([bool]) }
    'next' { return Await ($session.TrySkipNextAsync()) ([bool]) }
    'previous' { return Await ($session.TrySkipPreviousAsync()) ([bool]) }
    'seek' { return Await ($session.TryChangePlaybackPositionAsync([long]([double]$value * 10000))) ([bool]) }
  }
  return $false
}

# ---- Brightness of built-in laptop panels (WMI) -----------------------------
$brightnessSupported = $null
$lastBrightness = -1
function Get-Brightness {
  if ($script:brightnessSupported -eq $false) { return -1 }
  try {
    $b = Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightness -ErrorAction Stop | Select-Object -First 1
    $script:brightnessSupported = $true
    return [int]$b.CurrentBrightness
  } catch {
    $script:brightnessSupported = $false
    return -1
  }
}

# ---- WinRT: notifications from other apps ---------------------------------------
# Windows keeps the list (the same one Action Center shows). This reads it once a second and
# reports the ones that are new. The first read only notes what is already there.
$notifListener = $null
$notifSeen = $null
$notifStatus = ''
$notifAsked = $false
$notifFailures = 0

function Poll-Notifications {
  if ($null -eq $asTask -or $script:notifFailures -ge 5) { return }
  try {
    if ($null -eq $script:notifListener) {
      $null = [Windows.UI.Notifications.Management.UserNotificationListener, Windows.UI.Notifications, ContentType = WindowsRuntime]
      $null = [Windows.UI.Notifications.NotificationKinds, Windows.UI.Notifications, ContentType = WindowsRuntime]
      $null = [Windows.UI.Notifications.KnownNotificationBindings, Windows.UI.Notifications, ContentType = WindowsRuntime]
      $script:notifListener = [Windows.UI.Notifications.Management.UserNotificationListener]::Current
    }
    $status = "$($script:notifListener.GetAccessStatus())"
    if ($status -eq 'Unspecified' -and -not $script:notifAsked) {
      # Windows may ask the user once. Wait for the answer, but not for ever.
      $script:notifAsked = $true
      try {
        $status = "$(Await ($script:notifListener.RequestAccessAsync()) ([Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus]) 30000)"
      } catch { }
    }
    if ($status -ne $script:notifStatus) {
      $script:notifStatus = $status
      Send @{ type = 'notifications-access'; status = $status }
    }
    if ($status -ne 'Allowed') { return }
    $listType = [System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.UserNotification]]
    $list = Await ($script:notifListener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)) $listType
    $first = $null -eq $script:notifSeen
    $now = @{}
    foreach ($item in $list) {
      $id = [string]$item.Id
      $now[$id] = $true
      if ($first -or $script:notifSeen.ContainsKey($id)) { continue }
      $app = ''
      try { $app = [string]$item.AppInfo.DisplayInfo.DisplayName } catch { }
      $lines = @()
      try {
        $binding = $item.Notification.Visual.GetBinding([Windows.UI.Notifications.KnownNotificationBindings]::ToastGeneric)
        if ($binding) { foreach ($t in $binding.GetTextElements()) { $lines += [string]$t.Text } }
      } catch { }
      Send @{ type = 'notification'; id = $id; app = $app; lines = @($lines) }
    }
    $script:notifSeen = $now
    $script:notifFailures = 0
  } catch {
    $script:notifFailures++
    if ($script:notifFailures -eq 5) { Send @{ type = 'error'; where = 'notifications'; message = $_.Exception.Message } }
  }
}

# ---- Main loop ----------------------------------------------------------------
$features = @{ media = $false; volume = $false; privacy = $false; power = $false; clipboard = $false; brightness = $false; notifications = $false }
$lastVolume = ''
$lastMic = $null
$lastCam = $null
$lastPower = ''
$lastClip = [uint32]0
$tick = 0

Send @{ type = 'ready'; pid = $PID }

while ($true) {
  $line = [HeloHelper.Input]::Take(100)
  while ($null -ne $line) {
    if ($line -eq '__EOF__') { exit 0 }
    $id = $null
    try {
      $msg = $line | ConvertFrom-Json
      $id = $msg.id
      $result = $null
      switch ($msg.cmd) {
        'enable' { foreach ($p in $msg.features.PSObject.Properties) { $features[$p.Name] = [bool]$p.Value }; $lastMediaJson = ''; $lastVolume = ''; $lastMic = $null; $lastCam = $null; $lastPower = ''; $lastBrightness = -1; $result = $true }
        'media' { $result = Invoke-Media $msg.action $msg.value; Poll-Media $true }
        'volume' { $result = [HeloHelper.Audio]::Set([int]$msg.value) }
        'mute' { $result = [HeloHelper.Audio]::Mute([bool]$msg.value) }
        'brightness' {
          Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightnessMethods -ErrorAction Stop |
            Invoke-CimMethod -MethodName WmiSetBrightness -Arguments @{ Timeout = [uint32]1; Brightness = [byte]$msg.value } | Out-Null
          $result = $true
        }
        'ddc-list' { $result = [HeloHelper.Ddc]::List([byte]$msg.code) }
        'ddc-set' { $result = [HeloHelper.Ddc]::Set([int]$msg.index, [byte]$msg.code, [uint32]$msg.value) }
        'foreground' { $result = [HeloHelper.Native]::ForegroundPid() }
        'foreground-app' {
          $fg = Get-Process -Id ([HeloHelper.Native]::ForegroundPid()) -ErrorAction SilentlyContinue
          $name = if ($fg) { $fg.ProcessName } else { '' }
          $result = $name + '|' + [HeloHelper.Native]::ForegroundFullscreen()
        }
        'foreground-window' { $result = [HeloHelper.Native]::ForegroundWindow() }
        'activate' { $result = [HeloHelper.Native]::Activate([long]$msg.handle) }
        'pid-at' { $result = [HeloHelper.Native]::PidAt([int]$msg.x, [int]$msg.y) }
        'cursor-pos' { $result = [HeloHelper.Native]::CursorPos() }
        'move-cursor' { $result = [HeloHelper.Native]::MoveCursor([int]$msg.x, [int]$msg.y) }
        'windows' { $result = [HeloHelper.Procs]::Windows() }
        'proc-cpu' { $result = [HeloHelper.Procs]::TreeCpu([int]$msg.pid) }
        'ping' { $result = 'pong' }
        default { throw "unknown command $($msg.cmd)" }
      }
      Send @{ type = 'reply'; id = $id; ok = $true; result = $result }
    } catch {
      Send @{ type = 'reply'; id = $id; ok = $false; error = $_.Exception.Message }
    }
    $line = [HeloHelper.Input]::Take(0)
  }

  $tick++
  try {
    if ($features.volume) {
      $v = [HeloHelper.Audio]::Get()
      if ($v -ne $lastVolume) {
        $lastVolume = $v
        if ($v) { $parts = $v.Split('|'); Send @{ type = 'volume'; level = [int]$parts[0]; muted = ($parts[1] -eq '1') } }
        else { Send @{ type = 'volume'; level = $null; muted = $false } }
      }
    }
    if ($features.clipboard) {
      $seq = [HeloHelper.Native]::ClipboardSequence()
      if ($seq -ne $lastClip) {
        $lastClip = $seq
        Send @{ type = 'clipboard'; seq = $seq; excluded = [HeloHelper.Native]::ClipboardExcluded() }
      }
    }
    if ($features.media -and ($tick % 5 -eq 0)) { Poll-Media $false }
    if ($features.notifications -and ($tick % 10 -eq 5)) { Poll-Notifications }
    if ($features.privacy -and ($tick % 10 -eq 0)) {
      $mic = [HeloHelper.Privacy]::InUse('microphone')
      $cam = [HeloHelper.Privacy]::InUse('webcam')
      if ($mic -ne $lastMic -or $cam -ne $lastCam) {
        $lastMic = $mic; $lastCam = $cam
        Send @{ type = 'privacy'; microphone = @($mic.Split("`n") | Where-Object { $_ }); camera = @($cam.Split("`n") | Where-Object { $_ }) }
      }
    }
    if ($features.power -and ($tick % 50 -eq 1)) {
      $p = [HeloHelper.Native]::Power()
      if ($p -ne $lastPower) {
        $lastPower = $p
        $parts = $p.Split('|')
        Send @{ type = 'power'; ac = [int]$parts[0]; flag = [int]$parts[1]; percent = [int]$parts[2] }
      }
    }
    if ($features.brightness -and ($tick % 10 -eq 3)) {
      $b = Get-Brightness
      if ($b -ne $lastBrightness) {
        $lastBrightness = $b
        Send @{ type = 'brightness'; level = $(if ($b -ge 0) { $b } else { $null }) }
      }
    }
  } catch {
    Send @{ type = 'error'; where = 'poll'; message = $_.Exception.Message }
  }
}
