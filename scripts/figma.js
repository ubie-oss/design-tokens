const fs = require('fs');
const { promisify } = require('util');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const writeFile = promisify(fs.writeFile);

const TOKEN = process.env.FIGMA_TOKEN;
const FIGMA_FILE_KEY = process.env.FIGMA_DESIGN_TOKEN_FILE_KEY;
const ROOT_FONT_SIZE = 16;

const fetchFigma = (path) =>
  fetch(`https://api.figma.com/v1/files/${FIGMA_FILE_KEY}${path}`, {
    headers: {
      'X-FIGMA-TOKEN': TOKEN,
    },
  }).then((response) => response.json());

const rgbaToHex = (r, g, b, a) => {
  const hr = Math.round(r).toString(16).padStart(2, '0');
  const hg = Math.round(g).toString(16).padStart(2, '0');
  const hb = Math.round(b).toString(16).padStart(2, '0');
  const ha = !a
    ? ''
    : Math.round(a * 255)
        .toString(16)
        .padStart(2, '0');

  return '#' + hr + hg + hb + ha;
};

const sortObjectByKeys = (obj) => {
  return Object.keys(obj).sort().reduce((acc, key) => {
    acc[key] = obj[key];
    return acc;
  }, {});
};

const extractAttribute = (name, document) => {
  if (name.startsWith('border')) {
    return document.strokes[0];
  } else if (name.startsWith('text')) {
    return document.children[0].fills[0];
  } else {
    return document.fills[0];
  }
};

const main = async () => {
  // Get components value
  const responseComponents = await fetchFigma('/components');
  const components = responseComponents.meta.components;

  const componentNodeIds = components.map((component) => component.node_id);
  const componentNodeIdsQuery = componentNodeIds.join(',');
  const { nodes: componentNodes } = await fetchFigma(`/nodes?ids=${componentNodeIdsQuery}`);

  // Generate color tokens
  const primitiveColors = {};

  Object.values(componentNodes)
    .filter(({ document }) => document.name.includes('PrimitiveColor'))
    .forEach(({ document }) => {
      const name = document.name.split('/')[1].toLowerCase();
      const c = document.fills[0].color;
      primitiveColors[name] = {
        value: rgbaToHex(c.r * 255, c.g * 255, c.b * 255, c.a),
      };
    });

  const semanticColors = {};

  Object.values(componentNodes)
    .filter(({ document }) => document.name.includes('SemanticColor'))
    .forEach(({ document }) => {
      const name = document.name.split('/')[1].toLowerCase();
      const attribute = extractAttribute(name, document);
      const { color } = attribute;
      const alpha = attribute.opacity != null ? attribute.opacity : color.a;
      semanticColors[name] = {
        value: rgbaToHex(color.r * 255, color.g * 255, color.b * 255, alpha),
      };
    });

  const primitiveColorContent = JSON.stringify({
    color: sortObjectByKeys(primitiveColors),
  }, null, 2);

  const semanticsColorContent = JSON.stringify({
    color: sortObjectByKeys(semanticColors),
  }, null, 2);

  // Generate Spacing tokens
  const spacings = {};
  Object.values(componentNodes)
    .filter(({ document }) => document.name.includes('Spacing'))
    .forEach(({ document }) => {
      const name = 'spacing' + '-' + document.name.split('/')[1].toLowerCase();
      const srcValue = document.absoluteBoundingBox.width;
      const value = Number(srcValue) / ROOT_FONT_SIZE;
      spacings[name] = {
        value: value,
        attributes: {
          note: `${srcValue}px`,
        },
      };
    });

  const spacingContent = JSON.stringify({
    size: sortObjectByKeys(spacings),
  }, null, 2);

  // Generate Typography tokens
  const typography = {};
  Object.values(componentNodes)
    .filter(({ document }) => document.name.includes('Typography'))
    .forEach(({ document }) => {
      const name = document.name.split('/')[1].toLowerCase();
      const textComponent = document.children.find((child) => child.name === document.name && child.type === 'TEXT');
      const srcLineHeight = textComponent.style.lineHeightPercentFontSize;
      const srcFontSize = textComponent.style.fontSize;
      const lineHeight = srcLineHeight / 100;
      const fontSize = srcFontSize / ROOT_FONT_SIZE + 'rem';
      typography[[name, 'size'].join('-')] = {
        value: fontSize,
        attributes: {
          note: `${srcFontSize}px`,
        },
      };
      typography[[name, 'line'].join('-')] = {
        value: lineHeight,
        attributes: {
          note: `${srcLineHeight}%`,
        },
      };
    });

  const typographyContent = JSON.stringify({
    text: sortObjectByKeys({
      ...typography,
      'base-family': {
        value:
          "-apple-system, 'Segoe UI', 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif, 'Segoe UI Emoji'",
      },
    }),
  }, null, 2);

  // Generate Radius tokens
  const radius = {};
  Object.values(componentNodes)
    .filter(({ document }) => document.name.includes('Radius'))
    .forEach(({ document }) => {
      const name = document.name.split('/')[1].toLowerCase();
      const value = document.cornerRadius;
      radius[name] = {
        value: `${value}px`,
      };
    });

  const radiusContent = JSON.stringify({
    radius: sortObjectByKeys(radius),
  }, null, 2);

  // Generate size/icon tokens
  const icon = {};
  Object.values(componentNodes)
    .filter(({ document }) => document.name.includes('IconSize'))
    .forEach(({ document }) => {
      const name = document.name.split('/')[1].toLowerCase();
      const srcValue = document.absoluteBoundingBox.width;
      const value = Number(srcValue) / ROOT_FONT_SIZE;
      icon[name] = {
        value: value,
        attributes: {
          note: `${srcValue}px`,
        },
      };
    });

  const iconContent = JSON.stringify({
    icon: sortObjectByKeys(icon),
  }, null, 2);

  await writeFile(path.resolve(__dirname, '../tokens/color/primitive.json'), primitiveColorContent);
  await writeFile(path.resolve(__dirname, '../tokens/color/semantics.json'), semanticsColorContent);
  await writeFile(path.resolve(__dirname, '../tokens/size/spacing.json'), spacingContent);
  await writeFile(path.resolve(__dirname, '../tokens/text/typography.json'), typographyContent);
  await writeFile(path.resolve(__dirname, '../tokens/size/radius.json'), radiusContent);
  await writeFile(path.resolve(__dirname, '../tokens/size/icon.json'), iconContent);
  console.log('DONE');
};

main();
