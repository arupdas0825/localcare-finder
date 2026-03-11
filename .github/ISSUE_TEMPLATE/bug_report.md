name: Bug Report
description: Create a report to help us improve LocalCare Finder
title: "[BUG] "
labels: ["bug"]
body:
  - type: markdown
    attributes:
      value: |
        Thank you for taking the time to report a bug! Please fill out this form as completely as possible.
  
  - type: textarea
    id: description
    attributes:
      label: Describe the bug
      description: A clear and concise description of what the bug is.
      placeholder: When I click on X, Y happens instead of Z...
    validations:
      required: true

  - type: textarea
    id: steps_to_reproduce
    attributes:
      label: Steps to Reproduce
      description: Steps to reproduce the behavior.
      placeholder: |
        1. Go to '...'
        2. Click on '....'
        3. Scroll down to '....'
        4. See error
    validations:
      required: true

  - type: textarea
    id: expected_behavior
    attributes:
      label: Expected behavior
      description: A clear and concise description of what you expected to happen.
    validations:
      required: true
      
  - type: textarea
    id: environment
    attributes:
      label: Environment Details
      description: Please provide details about your environment.
      placeholder: |
        - OS: [e.g. Windows 11, macOS 13]
        - Browser [e.g. Chrome, Safari]
        - Python Version [e.g. 3.10]
    validations:
      required: true

  - type: textarea
    id: additional_context
    attributes:
      label: Additional context
      description: Add any other context about the problem here (e.g., screenshots, logs).
    validations:
      required: false
