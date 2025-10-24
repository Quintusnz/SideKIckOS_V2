# Contributing to SideKick

Thanks for your interest in contributing to SideKick! This document provides guidelines and instructions for contributing.

---

## 🎯 What Can You Contribute?

- **Bug Fixes** - Fix issues in the codebase
- **New Skills** - Add custom skills to `/skills`
- **Workflows** - Create new workflow examples
- **Documentation** - Improve guides and comments
- **Tests** - Add test coverage for existing code
- **Performance** - Optimize existing code
- **UI/UX** - Improve the chat interface

---

## 🚀 Getting Started

### 1. Fork the Repository
Click "Fork" on GitHub to create your own copy.

### 2. Clone Your Fork
```bash
git clone https://github.com/YOUR-USERNAME/SideKIckOS_V2.git
cd SideKick
```

### 3. Add Upstream Remote
```bash
git remote add upstream https://github.com/Quintusnz/SideKIckOS_V2.git
git fetch upstream
```

### 4. Create Feature Branch
```bash
git checkout -b feature/amazing-feature
```

### 5. Install Dependencies
```bash
npm install
```

---

## 💻 Development Workflow

### Before Starting
```bash
# Ensure you're on latest main
git fetch upstream
git checkout main
git reset --hard upstream/main

# Create your feature branch
git checkout -b feature/your-feature-name
```

### During Development
```bash
# Start dev server
npm run dev

# In another terminal, run tests in watch mode
npm run test:watch

# Check linting
npm run lint
npm run lint:fix
```

### Code Quality Standards

- **TypeScript** - All code must be TypeScript (no `any` without justification)
- **Tests** - New features must have tests
- **Linting** - Code must pass ESLint (`npm run lint`)
- **Comments** - Complex logic should be commented
- **Type Safety** - Avoid `any` types, use proper interfaces

### Writing Tests

Place tests in `src/__tests__/` matching your feature:

```typescript
// src/__tests__/unit/my-feature.test.ts
import { describe, it, expect } from 'vitest';
import { myFeature } from '@/lib/my-feature';

describe('My Feature', () => {
  it('should do something', () => {
    const result = myFeature('input');
    expect(result).toBe('expected');
  });
});
```

Run tests:
```bash
npm run test              # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

---

## ✨ Adding a New Skill

### 1. Create Skill Directory
```bash
mkdir skills/my_awesome_skill
cd skills/my_awesome_skill
```

### 2. Create `SKILL.md`
```yaml
---
name: My Awesome Skill
version: 1.0.0
description: What this skill does
category: category
tools: []
input_schema:
  param1: string
  param2: number
output_format: markdown
---
# My Awesome Skill

Full documentation of what this skill does...

## Parameters
- `param1` (string): Description
- `param2` (number): Description

## Example Usage
```

### 3. Create `logic.ts`
```typescript
export default async function myAwesomeSkill(input: {
  param1: string;
  param2: number;
}) {
  // Your implementation
  return {
    result: "...",
  };
}
```

### 4. Test Your Skill
```bash
npm run dev
# Navigate to http://localhost:3000 and test the skill in chat
```

### 5. Commit Your Skill
```bash
git add skills/my_awesome_skill/
git commit -m "feat: Add my awesome skill"
```

---

## 📋 Commit Message Guidelines

Use clear, descriptive commit messages:

```
feat: Add new skill description
fix: Resolve bug in orchestrator
docs: Update README with new info
test: Add tests for skill registry
refactor: Simplify chat interface logic
perf: Optimize skill loading
style: Format code with Prettier
```

Format: `<type>: <description>`

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `test` - Tests
- `refactor` - Code refactoring
- `perf` - Performance
- `style` - Code style

---

## 🧪 Testing Your Changes

Before submitting:

```bash
# Run all tests
npm run test

# Check linting
npm run lint

# Build for production
npm run build

# Check git status
git status
git diff
```

All tests must pass and linting must be clean.

---

## 📝 Submitting a Pull Request

### 1. Push to Your Fork
```bash
git push origin feature/your-feature-name
```

### 2. Create Pull Request
Go to GitHub and click "Compare & pull request"

### 3. Fill in PR Details
- **Title:** Clear, descriptive title
- **Description:** Explain what changed and why
- **Related Issues:** Link any related issues (#123)

### 4. PR Template
```markdown
## Description
What does this PR do?

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## Testing
How was this tested?

## Checklist
- [ ] Tests pass
- [ ] Linting passes
- [ ] Documentation updated
- [ ] No breaking changes
```

### 5. Wait for Review
A maintainer will review your PR and provide feedback or merge it.

---

## 🔍 PR Review Process

### Code Review Checklist
- ✅ Code follows TypeScript standards
- ✅ All tests pass
- ✅ Linting passes
- ✅ Documentation is updated
- ✅ No breaking changes (unless major version)
- ✅ Comments explain complex logic

### Common Feedback
- "Add tests for this feature"
- "Please refactor this to be more readable"
- "Consider using this utility function instead"
- "Need to update documentation"

---

## 🐛 Reporting Bugs

### Bug Report Template
```markdown
## Description
Clear description of the bug

## Steps to Reproduce
1. Step 1
2. Step 2
3. Bug happens

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- Node version: 18.x
- OS: Windows/Mac/Linux
- Browser: Chrome/Firefox/etc
```

---

## 💡 Feature Requests

### Feature Request Template
```markdown
## Description
What feature should be added?

## Motivation
Why is this needed?

## Proposed Solution
How should it work?

## Alternatives
What are other approaches?
```

---

## 🎓 Learning Resources

- **TypeScript:** https://www.typescriptlang.org/docs/
- **Next.js:** https://nextjs.org/docs
- **Vitest:** https://vitest.dev/
- **Vercel AI SDK:** https://sdk.vercel.ai/

---

## 🤝 Community Guidelines

- Be respectful and constructive
- Help others learn and grow
- Ask questions if unclear
- Share knowledge and experience
- No harassment or discrimination

---

## 📚 Project Structure Reference

```
SideKick/
├── src/app/api/          ← API endpoints
├── src/lib/              ← Core logic
├── src/components/       ← React components
├── skills/               ← Skill definitions
├── workflows/            ← Workflow definitions
├── src/__tests__/        ← Tests
└── Docs/                 ← Documentation
```

---

## 🚀 First-Time Contributors

Great first issues to start with:
- Adding tests to untested code
- Improving documentation
- Creating new skills
- Fixing typos and formatting
- Optimizing performance

Look for issues labeled `good first issue` or `help wanted`.

---

## 📞 Questions?

- Open an issue on GitHub
- Start a discussion
- Check existing documentation
- Review similar code examples

---

## ✅ Before You Submit

- [ ] Fork the repository
- [ ] Create a feature branch
- [ ] Make your changes
- [ ] Add/update tests
- [ ] Run `npm run test` - all pass?
- [ ] Run `npm run lint` - no errors?
- [ ] Run `npm run build` - builds successfully?
- [ ] Update documentation
- [ ] Push to your fork
- [ ] Submit pull request

---

## 🎉 Thank You!

Thank you for contributing to SideKick! Your contributions help make this project better.

**Happy coding!** 🚀

---

*Last Updated: October 24, 2025*
