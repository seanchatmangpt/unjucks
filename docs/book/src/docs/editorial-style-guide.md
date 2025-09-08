# Editorial Style Guide
## Unjucks: Modern Code Generation in 2026

### Publication Overview
- **Title**: Unjucks: Modern Code Generation in 2026
- **Focus**: Comprehensive guide to the Unjucks template system and modern code generation practices
- **Target Audience**: Software developers, technical architects, and development teams
- **Publication Type**: Technical reference and practical guide

### Writing Style and Voice

#### Tone
- **Professional yet approachable**: Technical accuracy without academic stiffness
- **Forward-looking**: Emphasizes modern practices and 2026 perspectives
- **Practical**: Every concept supported by real examples and use cases
- **Confident**: Authoritative guidance based on established patterns

#### Voice Characteristics
- Active voice preferred over passive voice
- Present tense for current capabilities, future tense for roadmap items
- Second person ("you") when addressing the reader directly
- First person plural ("we") when discussing collective developer practices

#### Technical Language Standards
- **Consistent terminology**: Use standardized terms throughout (see Glossary below)
- **Code examples**: Always syntactically valid and runnable
- **Version specificity**: Include version numbers when referencing tools
- **Cross-references**: Link related concepts and chapters

### Content Organization Standards

#### Chapter Structure Template
```
# Chapter N: [Descriptive Title]

## Learning Objectives
[3-5 specific, measurable objectives]

## Introduction
[Context and motivation - why this chapter matters]

## Core Content
[Main sections with practical examples]

## Real-World Applications
[Practical examples and case studies]

## Best Practices and Pitfalls
[Do's and don'ts with explanations]

## Integration with Other Chapters
[How this connects to other concepts]

## Summary
[Key takeaways and next steps]

## Further Reading
[External resources and references]
```

#### Code Example Standards
- All code examples must be syntactically valid
- Include file paths and context
- Use consistent naming conventions
- Provide both minimal and complete examples
- Include error handling where appropriate

### Terminology Glossary

#### Core Concepts
- **Unjucks**: The code generation framework (always capitalized)
- **Template**: A Nunjucks template with frontmatter configuration
- **Generator**: A collection of templates that work together
- **Frontmatter**: YAML configuration at the top of template files
- **Injection**: Adding content to existing files intelligently
- **Context**: Variables and environment information available to templates

#### Technical Terms
- **Nunjucks**: The underlying templating engine
- **Hygen**: Legacy/inspiration tool for comparison
- **ESM**: ECMAScript Modules
- **TypeScript**: Always written out, not "TS"
- **CLI**: Command Line Interface
- **DX**: Developer Experience

#### File and Path Conventions
- Use forward slashes for all paths (even on Windows examples)
- Template directory: `_templates` (with underscore)
- Config file: `unjucks.config.ts`
- Generated files go in `src/` unless specified otherwise

### Cross-Reference Standards

#### Internal References
- Format: "As discussed in [Chapter N: Title](#chapter-link)"
- Always include both chapter number and descriptive title
- Use relative links for within-chapter references
- Create index of all cross-references for validation

#### External References
- Include version numbers and dates when possible
- Provide both primary and backup links where available
- Regular link validation required

### Code and Command Standards

#### Command Line Examples
```bash
# Always include comments explaining context
unjucks generate component UserProfile

# Show expected output where helpful
# Generated:
#   src/components/UserProfile/UserProfile.tsx
#   src/components/UserProfile/index.ts
```

#### Configuration Examples
- Always show complete, valid configuration files
- Use TypeScript for config files (unjucks.config.ts)
- Include comments explaining non-obvious settings
- Show both minimal and production configurations

#### Code Block Languages
- `bash` for command line
- `typescript` for TypeScript code
- `javascript` for plain JS
- `yaml` for frontmatter and config
- `json` for package.json and similar

### Visual and Formatting Standards

#### Headings Hierarchy
- H1: Chapter titles only
- H2: Major sections
- H3: Subsections
- H4: Specific topics (use sparingly)
- No H5 or H6

#### Lists and Bullets
- Use `-` for unordered lists
- Use `1.` for ordered lists
- No more than 3 levels of nesting
- Parallel structure in list items

#### Emphasis and Highlighting
- **Bold** for important terms and concepts
- *Italic* for file names and paths
- `Code` for inline code and commands
- > Blockquotes for important warnings and tips

### Quality Assurance Checklist

#### Content Quality
- [ ] All code examples tested and validated
- [ ] Consistent terminology throughout
- [ ] Clear learning objectives for each chapter
- [ ] Practical examples for every concept
- [ ] Cross-references validated and working

#### Technical Accuracy
- [ ] All commands produce expected output
- [ ] Configuration examples are complete
- [ ] Version numbers are current and accurate
- [ ] No deprecated patterns or anti-patterns

#### Editorial Consistency
- [ ] Consistent voice and tone
- [ ] Proper chapter structure followed
- [ ] Glossary terms used consistently
- [ ] Style guide compliance verified

### Production Readiness Standards

#### Pre-Publication Checklist
- [ ] All placeholder content replaced with real content
- [ ] Code examples tested in clean environment
- [ ] External links verified and working
- [ ] Cross-references validated
- [ ] Spelling and grammar checked
- [ ] Technical review completed
- [ ] Accessibility standards met

#### mdBook Specific Requirements
- [ ] SUMMARY.md matches actual content structure
- [ ] All referenced files exist
- [ ] book.toml configuration optimized
- [ ] Search functionality working
- [ ] Print formatting acceptable
- [ ] Mobile responsiveness verified

### Update and Maintenance Standards

#### Version Control
- All editorial changes tracked in git
- Commit messages describe editorial changes clearly
- Branch strategy for major editorial revisions

#### Content Lifecycle
- Regular review cycle for technical accuracy
- Version compatibility updates
- Dead link monitoring and repair
- Community feedback integration process

---

This style guide ensures that the Unjucks book maintains professional quality, technical accuracy, and editorial consistency throughout its publication lifecycle.