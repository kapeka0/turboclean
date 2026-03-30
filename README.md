# turboclean

Recursively finds and deletes `.next` and `node_modules` directories.

## Usage

```bash
npx turboclean                                   # current directory
npx turboclean ./projects                        # specific path
npx turboclean ./projects --exclude app1,app2   # exclude folders
```

## Options

| Option | Description |
|---|---|
| `[path]` | Root directory to scan (default: cwd) |
| `--exclude a,b,...` | Comma-separated folder names to skip |

## Output

```
Scanning: /path/to/projects
Excluding: app1, app2

  skipping /projects/app1
  ✓ deleting /projects/app2/.next (142.35 MB)
  ✓ deleting /projects/app2/node_modules (312.18 MB)

Done. Removed 2 directories, freed 454.53 MB.
```

## Install globally

```bash
npm install -g turboclean
turboclean ./projects --exclude legacy
```
# turboclean
