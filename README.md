# Ubie Design Tokens

This is a package for using the design tokens defined in Ubie's products in development. Design tokens are managed in JSON format and are converted to the format for each platform using [Style Dictionary](https://amzn.github.io/style-dictionary/).

Figma file is published in Figma Community.
https://www.figma.com/community/file/1139108856002045571

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
import DesignTokens from '@ubie/design-tokens';
```

## Development

1. create .env file and include file id and token

```bash
cp .env_sample .env
```

- You can generate a token from the settings page in Figma.
- If you’re Ubie member and want to know FIGMA_DESIGN_TOKEN_FILE_KEY, please ask to `@designer` on Ubie Slack.

2. Convert design tokens defined in Figma to JSON format files

```bash
npm run --env-file=.env build:figma
```

3. Converts JSON files to the format used by each platform

```bash
npm run build:tokens
```

Edit `config.json` if you need to add a supported platform. Please refer to the [Style Dictionary documentation](https://amzn.github.io/style-dictionary/#/config?id=platform) for details.

## LICENSE

This Ubie Design Tokens is licensed under the [Apache License 2.0](https://github.com/ubie-oss/design-tokens/blob/main/LICENSE).
