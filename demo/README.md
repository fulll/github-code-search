# Demo

This directory contains the [VHS](https://github.com/charmbracelet/vhs) tape used to generate
the animated demo (`demo.gif`) embedded in the root README.

## Regenerate the animation

1. Install VHS:

   ```bash
   brew install vhs
   ```

2. Build the binary:

   ```bash
   bun run build.ts
   ```

3. Export your GitHub token and record:

   ```bash
   export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
   vhs demo.tape        # writes demo.gif
   ```

The GIF is committed alongside this file and referenced from the root README as `![Demo](demo/demo.gif)`.
