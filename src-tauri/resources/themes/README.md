# Puck color themes

Place custom color themes in this folder as `{id}.css` files.

Theme ids use lowercase letters, digits, and hyphens. The settings UI derives display names from the id:

- English: hyphens become spaces, first letter of each word is capitalized (`aa-1` → `Aa 1`)
- Chinese: hyphens become spaces only (`aa-1` → `aa 1`)

Each CSS file should define light and dark variables:

```css
:root[data-color-theme="my-theme"] {
  --background: oklch(1 0 0);
  /* ... */
}

.dark[data-color-theme="my-theme"] {
  --background: oklch(0.145 0 0);
  /* ... */
}
```

The built-in `default` theme ships with the app and is not stored here.

Reopen Settings to pick up newly added theme files.
