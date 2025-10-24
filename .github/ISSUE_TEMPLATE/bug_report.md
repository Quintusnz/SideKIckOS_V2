name: Bug Report
description: Report a bug in SideKick
title: "[BUG] "
labels: ["bug"]

body:
  - type: markdown
    attributes:
      value: |
        Thanks for reporting a bug! Please fill out the form below to help us understand and fix the issue.

  - type: textarea
    attributes:
      label: Description
      description: Clear description of the bug
      placeholder: "The chat interface freezes when..."
    validations:
      required: true

  - type: textarea
    attributes:
      label: Steps to Reproduce
      description: Steps to reproduce the behavior
      placeholder: |
        1. Navigate to http://localhost:3000
        2. Type a message
        3. See error in console
    validations:
      required: true

  - type: textarea
    attributes:
      label: Expected Behavior
      description: What should happen?
      placeholder: "The message should send and stream a response..."
    validations:
      required: true

  - type: textarea
    attributes:
      label: Actual Behavior
      description: What actually happens?
      placeholder: "The message never sends, and I see an error in the console..."
    validations:
      required: true

  - type: dropdown
    attributes:
      label: Environment
      description: Where does this occur?
      options:
        - Development (npm run dev)
        - Production
        - Docker
        - Vercel
        - Other
    validations:
      required: true

  - type: input
    attributes:
      label: Node Version
      description: Output of `node --version`
      placeholder: "v18.17.0"
    validations:
      required: true

  - type: input
    attributes:
      label: OS
      description: Operating system
      placeholder: "Windows 11 / macOS 13 / Ubuntu 20.04"
    validations:
      required: true

  - type: textarea
    attributes:
      label: Error Message
      description: Any error message from console
      placeholder: "TypeError: Cannot read property 'xyz' of undefined"
    validations:
      required: false

  - type: textarea
    attributes:
      label: Additional Context
      description: Any other information that might help
      placeholder: "I noticed this only happens when..."
    validations:
      required: false

  - type: checkboxes
    attributes:
      label: Checklist
      options:
        - label: I've searched for similar issues
          required: true
        - label: I've read the documentation
          required: false
