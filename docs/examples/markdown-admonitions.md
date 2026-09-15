# Admonitions and disclosures

Use a GitHub-style alert for a simple note, or an extended admonition for a custom title, folding or nesting. Both use the same visual treatment.

## 1. Ordinary notes

These two notes should share their title, icon, colors and spacing:

> [!NOTE]
> Keep the original document and its images together.

!!! note

    Keep the original document and its images together.

## 2. Custom and hidden titles

!!! warning "Back up before upgrading"

    Save the current configuration before changing it.

!!! tip ""

    This tip deliberately has no title row. [Jump to a heading inside nested disclosures](#nested-details).

!!! caution "<strong>Literal title</strong>"

    The title above is plain text, including the angle brackets.

## 3. Closed and open disclosures

The first block starts closed and works with the keyboard. The second starts open. Printing includes both bodies.

??? tip "Show the command"

    ### Restart safely

    Copying this command excludes the title and line numbers:

    ```bash title="Terminal" linenums="1"
    echo "Ready to restart"
    ```

???+ success "Checks completed"

    - The configuration is backed up.
    - The document is ready to share.

## 4. Nested content and images

??? example "Expand the example"

    ??? important "Expand the details"

        ### Nested details

        Following the heading link opens both disclosures. This image is bundled even when its containing block starts closed:

        ![Mote icon](../assets/favicon-32.png)

        Reference-style images and HTML picture sources follow the same publishing rules:

        ![Same icon][icon]

        <picture><source srcset="../assets/favicon-32.png 2x"><img src="../assets/favicon-32.png" alt="Same icon through HTML" width="32"></picture>

[icon]: ../assets/favicon-32.png

## 5. HTML disclosures

HTML disclosures use the same title band and reading surface. Their summary text and initial open state are preserved:

<details><summary>Show the command (HTML)</summary>

### HTML disclosure content

This body uses the normal page background. **Formatting** and code remain readable.

```bash
echo "Ready to restart"
```

</details>

<details open><summary>Checks completed (HTML)</summary>

- The configuration is backed up.
- Printing includes the body of both HTML disclosures, even if closed.

</details>

## 6. Ordinary Markdown fallback

The unknown type below stays ordinary Markdown; its indented image example must not be uploaded:

!!! unknown "Unsupported type"

    ![Only an example](must-not-upload.png)

The following is a code sample, not another component:

```markdown
!!! note "Example source"

    ![Only an example](also-must-not-upload.png)
```
