name: Feature Request
description: Suggest a new feature for SideKick
title: "[FEATURE] "
labels: ["enhancement"]

body:
  - type: markdown
    attributes:
      value: |
        Thanks for suggesting a feature! Please provide details below.

  - type: textarea
    attributes:
      label: Description
      description: What feature should be added?
      placeholder: "Add ability to save chat history..."
    validations:
      required: true

  - type: textarea
    attributes:
      label: Motivation
      description: Why is this feature needed?
      placeholder: "Users need to be able to review previous conversations..."
    validations:
      required: true

  - type: textarea
    attributes:
      label: Proposed Solution
      description: How should this feature work?
      placeholder: "Add a 'Save' button next to each chat..."
    validations:
      required: true

  - type: textarea
    attributes:
      label: Alternatives
      description: Other approaches you've considered
      placeholder: "Alternative: Auto-save after every message..."
    validations:
      required: false

  - type: textarea
    attributes:
      label: Additional Context
      description: Any other information
      placeholder: "This would integrate well with..."
    validations:
      required: false

  - type: checkboxes
    attributes:
      label: Checklist
      options:
        - label: I've searched for similar feature requests
          required: true
        - label: This doesn't already exist in another form
          required: true
