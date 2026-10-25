# Desktop profile snapshot (read-only)

These two files are **copies** of the profile that loads this plugin on this machine:

| Snapshot | Live file |
|---|---|
| `cordis.patch.yml` | `%USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml` |
| `package.json` | `%USERPROFILE%\.dsh\profiles\desktop\package.json` |

Nothing reads them from here — the app reads the live files. They are versioned so the profile state
that is known to work can be compared against and restored.

## Why this exists

Toggling this plugin's **row** switch in the in-app Plugins page writes a disable record into the live
`cordis.patch.yml`:

```yaml
- id: session-changes
  disabled: true
```

Re-enabling the bundle does not remove it, and the plugin then silently never loads. That failure has no
other audit trail, which is what this snapshot is for.

## Comparing and restoring

```powershell
cd plugins\dsh-session-changes
git diff --no-index profile\cordis.patch.yml "$env:USERPROFILE\.dsh\profiles\desktop\cordis.patch.yml"
```

Restoring is a copy back to the live path followed by an app restart (the profile is composed at Host
start, so a page reload is not enough):

```powershell
Copy-Item profile\cordis.patch.yml "$env:USERPROFILE\.dsh\profiles\desktop\cordis.patch.yml" -Force
```

Do not toggle the plugin's row switch; ask for a profile fix instead, or uninstall/reinstall the bundle.
