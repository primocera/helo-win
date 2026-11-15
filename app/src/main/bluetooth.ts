// Battery levels of connected Bluetooth devices, read from the same device
// property Windows shows under Settings > Bluetooth & devices. Devices that do
// not report a level to Windows are simply absent.
import { execFile } from 'node:child_process';
import type { BluetoothBattery } from '../shared/types';

// DEVPKEY_Bluetooth_Battery ({104EA319-6EE2-4701-BD47-8DDBF425BBE5}, 2): percent, 0-100.
const SCRIPT = [
  "$ErrorActionPreference = 'SilentlyContinue'",
  "Get-PnpDevice -Class Bluetooth -PresentOnly | Where-Object { $_.Status -eq 'OK' } | ForEach-Object {",
  "  $p = Get-PnpDeviceProperty -InstanceId $_.InstanceId -KeyName '{104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2'",
  "  if ($p -and $p.Type -ne 'Empty' -and $null -ne $p.Data) { '{0}|{1}' -f ($_.FriendlyName -replace '\\|', ' '), $p.Data }",
  '}',
].join('\n');

/** Parses "name|percent" lines; one entry per device name, sorted by name. */
export function parseBluetoothBatteries(text: unknown): BluetoothBattery[] {
  if (typeof text !== 'string') return [];
  const byName = new Map<string, number>();
  for (const line of text.split(/\r?\n/)) {
    const cut = line.lastIndexOf('|');
    if (cut < 1) continue;
    const name = line.slice(0, cut).trim().slice(0, 60);
    const raw = line.slice(cut + 1).trim();
    const percent = /^\d{1,3}$/.test(raw) ? Number(raw) : Number.NaN;
    if (!name || !Number.isInteger(percent) || percent > 100 || byName.has(name)) continue;
    byName.set(name, percent);
  }
  return [...byName].map(([name, percent]) => ({ name, percent })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Runs one short-lived PowerShell process. Resolves to [] when there is no Bluetooth or nothing reports a level. */
export function readBluetoothBatteries(timeoutMs = 30_000): Promise<BluetoothBattery[]> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SCRIPT],
      { windowsHide: true, timeout: timeoutMs, maxBuffer: 1_000_000 },
      (err, stdout) => resolve(err ? [] : parseBluetoothBatteries(stdout)),
    );
  });
}
