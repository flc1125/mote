import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { CliError } from '../errors.js';

/** The path is data, not executable PowerShell. No credential ever enters argv. */
export function aclScript(path: string, initializeDirectory: boolean): string {
  const literal = path.replaceAll("'", "''");
  return `
$ErrorActionPreference = 'Stop'
$target = '${literal}'
$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$item = Get-Item -LiteralPath $target -Force
if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Reparse point' }
$acl = Get-Acl -LiteralPath $target
if ($acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $sid.Value) { throw 'Wrong owner' }
${
  initializeDirectory
    ? `
if (-not $item.PSIsContainer) { throw 'Not a directory' }
$acl = New-Object System.Security.AccessControl.DirectorySecurity
$acl.SetOwner($sid)
$acl.SetAccessRuleProtection($true, $false)
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
$acl.AddAccessRule($rule)
Set-Acl -LiteralPath $target -AclObject $acl
$acl = Get-Acl -LiteralPath $target
`
    : ''
}
if ($item.PSIsContainer -and -not $acl.AreAccessRulesProtected) { throw 'Inherited directory ACL' }
$rules = $acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])
$allowed = $false
foreach ($rule in $rules) {
  if ($rule.AccessControlType -eq 'Allow') {
    if ($rule.IdentityReference.Value -ne $sid.Value) { throw 'Broad ACL' }
    if (($rule.FileSystemRights -band [System.Security.AccessControl.FileSystemRights]::FullControl) -eq [System.Security.AccessControl.FileSystemRights]::FullControl) { $allowed = $true }
  }
}
if (-not $allowed) { throw 'Missing private access' }
`;
}
export async function verifyWindowsAcl(path: string, initializeDirectory = false) {
  try {
    await promisify(execFile)(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(aclScript(path, initializeDirectory), 'utf16le').toString('base64'),
      ],
      { timeout: 15000, windowsHide: true, maxBuffer: 65536 },
    );
  } catch {
    throw new CliError(
      'cannot verify private Windows auth storage ACL; no credentials were read or written',
    );
  }
}
