# TypeScript Error: Template Files Being Processed as TypeScript

## Issue
**File:** `tests/fixtures/common/basic-template.js`  
**Error:** Multiple TS1109, TS1005, TS1134 errors due to template syntax in `.js` file

## Root Cause
The file `tests/fixtures/common/basic-template.js` contains template syntax (`<%= %>`, `---`) that is being processed by the TypeScript compiler, but it's actually a template file, not a JavaScript/TypeScript file.

## Affected Code
```javascript
---
to: src/components/<%= name %>.tsx
inject: false
---
import React from 'react';

interface <%= name %>Props {
  // Add props here
}

export const <%= name %>: React.FC<<%= name %>Props> = (props) => {
  return (
    <div>
      <h1><%= name %> Component</h1>
    </div>
  );
};

export default <%= name %>;
```

## Potential Fixes

### Option 1: Exclude Template Files from TypeScript Compilation (Recommended)
- Add template file patterns to `tsconfig.json` exclude section:
```json
{
  "exclude": [
    "tests/fixtures/**/*.js",
    "**/*.template.*",
    "**/*.njk",
    "**/*.ejs"
  ]
}
```

### Option 2: Rename Template Files
- Rename `basic-template.js` to `basic-template.njk` or `basic-template.ejs`
- This prevents TypeScript from trying to compile template files

### Option 3: Move Template Files to Separate Directory
- Move all template files to a `templates/` directory
- Exclude the entire templates directory from TypeScript compilation

### Option 4: Use Different File Extension
- Change `.js` extension to `.template` or `.tmpl`
- Update any code that references these template files

## Impact Assessment
- **Low Risk:** Template files shouldn't be compiled as TypeScript
- **Configuration Issue:** This is primarily a build configuration problem
- **No Runtime Impact:** Templates are processed by template engines, not TypeScript

## Recommendation
Use Option 1 (exclude template files) as it's the most straightforward solution that prevents TypeScript from processing non-TypeScript files.
