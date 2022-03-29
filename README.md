# Ubie Design Tokens

This is a package for using the design tokens defined in Ubie's products in development. Design tokens are managed in JSON format and are converted to the format for each platform using [Style Dictionary](https://amzn.github.io/style-dictionary/).

Figma file is here.
https://www.figma.com/file/9LjkKt27YY9LfTK8Cwx08m/Ubie-Design-Tokens-(Public)?node-id=0%3A1

## Usage

```bash
npm install @ubie/design-tokens
```

This package contains files with three extensions: CSS, SCSS, and JS.

### CSS
```CSS
@import url('node_modules/@ubie/design-tokens/dist/tokens.css');
```

### SCSS
```SCSS
@import 'node_modules/@ubie/design-tokens/dist/tokens.scss';
```

### JS

```js
import DesignTokens from '@ubie/design-tokens'
```

## Development

1. Convert design tokens defined in Figma to JSON format files

```bash
FIGMA_TOKEN=*** FIGMA_DESIGN_TOKEN_FILE_KEY=*** yarn build:figma
```

2. Converts JSON files to the format used by each platform

```
yarn build:tokens
```

Edit `config.json` if you need to add a supported platform. Please refer to the [Style Dictionary documentation](https://amzn.github.io/style-dictionary/#/config?id=platform) for details.

## LICENSE

This Ubie Design Tokens is licensed under the [Apache License 2.0](https://github.com/ubie-oss/design-tokens/blob/main/LICENSE).