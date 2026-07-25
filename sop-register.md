# VisionInspect – AI Visual Quality Inspection Workflow for Smartphone Crack Detection

## Purpose

This document defines the visual inspection criteria used to identify and classify visible smartphone defects from uploaded images. The AI system evaluates each image based only on visible physical defects and classifies them according to the predefined inspection taxonomy.

## Scope

This Standard Operating Procedure (SOP) covers **non-safety-critical visual inspection of smartphones** within a **single bounded product category**. The inspection process focuses only on visible physical defects that can be identified from uploaded images.

This SOP does not include:

- Internal hardware diagnostics
- Software or operating system issues
- Battery health assessment
- Water damage assessment
- Detection of defects that are not visible in uploaded images
- Automatic acceptance or rejection of a device without human review

## Defect Categories

The smartphone inspection system uses a predefined taxonomy containing **20 categories of visible smartphone defects**. These include hairline screen cracks, corner cracks, edge cracks, vertical cracks, horizontal cracks, diagonal cracks, multiple cracks, spider-web cracks, shattered screens, deep screen cracks, surface glass cracks, LCD/OLED internal cracks, back-glass cracks, camera-lens cracks, frame cracks, screen separation, and the **No Defect Detected** category.

## Severity Policy

The severity of each detected defect is determined using predefined inspection rules based on the visible evidence identified in the uploaded image.

The following policies apply during inspection:

- Shattered screens, LCD/OLED internal cracks, and screen separation are always classified as **High Severity** because they significantly affect the device's functionality and structural integrity.
- Small surface cracks and hairline cracks may be classified as **Low** or **Medium Severity**, depending on their location and extent.
- If the AI system produces a confidence score below the defined confidence threshold, the inspection result must be reviewed manually before a final decision is made.

## Human Confirmation

Every inspection result must be reviewed by a human inspector before it becomes final.

The reviewer examines:

- The uploaded smartphone image
- The detected defect
- The confidence score
- The assigned severity level

The reviewer may either:

- **Confirm** the inspection result if it is correct.
- **Correct** the result if the detected defect or severity is inaccurate.

## Escalation

Any inspection that cannot be confidently verified, contains unclear visual evidence, or falls outside the scope of this SOP should be referred to a senior reviewer for further evaluation.