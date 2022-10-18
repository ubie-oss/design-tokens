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

const main = async () => {
  // Get styles value
  const responseStyles = await fetchFigma('/styles');
  const styles = responseStyles.meta.styles;

  const styleNodeIds = styles.map((style) => style.node_id);
  const styleNodeIdsQuery = styleNodeIds.join(',');
  const { nodes: styleNodes } = await fetchFigma(`/nodes?ids=${styleNodeIdsQuery}`);

  // Get components value
  const responseComponents = await fetchFigma('/components');
  const components = responseComponents.meta.components;

  const componentNodeIds = components.map((component) => component.node_id);
  const componentNodeIdsQuery = componentNodeIds.join(',');
  const { nodes: componentNodes } = await fetchFigma(`/nodes?ids=${componentNodeIdsQuery}`);

  // Generate color tokens
  const primitiveColors = {};

  Object.values(styleNodes)
    .filter(({ document }) => document.name.includes('Primitive'))
    .sort((a, b) => a.document.name.localeCompare(b.document.name))
    .forEach(({ document }) => {
      const { opacity, color } = document.fills[0];
      const { r, g, b } = color;
      const hex = rgbaToHex(r * 255, g * 255, b * 255, opacity);
      const colorNameArr = document.name.toLowerCase().split('/').slice(1);
      primitiveColors[colorNameArr.join('-')] = {
        value: hex,
      };
    });

  const semanticColors = {};

  Object.values(styleNodes)
    .filter(({ document }) => document.name.includes('Semantic'))
    .sort((a, b) => a.document.name.localeCompare(b.document.name))
    .forEach(({ document }) => {
      const { opacity, color } = document.fills[0];
      const { r, g, b } = color;
      const colorName = document.name.toLowerCase().replaceAll(' ', '/').split('/').slice(1).join('-');
      const style = styles.find((s) => s.name === document.name);
      const reference = style.description;
      semanticColors[colorName] = {
        value: !reference
          ? rgbaToHex(r * 255, g * 255, b * 255, opacity)
          : `{color.${reference.toLowerCase().replaceAll(' ', '-')}.value}`,
      };
    });

  const primitiveColorContent = JSON.stringify({
    color: {
      ...primitiveColors,
    },
  });

  const semanticsColorContent = JSON.stringify({
    color: {
      ...semanticColors,
    },
  });

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
    size: {
      ...spacings,
    },
  });

  // Generate Typography tokens
  const typography = {};
  Object.values(styleNodes)
    .filter(({ document }) => document.type === 'TEXT')
    .sort((a, b) => a.document.name.localeCompare(b.document.name))
    .forEach(({ document }) => {
      const name = document.name.split('/');
      const category = name[0].toLowerCase();
      const scale = name[1].toLowerCase();
      const srcLineHeight = document.style.lineHeightPercentFontSize;
      const srcFontSize = document.style.fontSize;
      const lineHeight = srcLineHeight / 100;
      const fontSize = srcFontSize / ROOT_FONT_SIZE + 'rem';
      typography[[category, scale, 'size'].join('-')] = {
        value: fontSize,
        attributes: {
          note: `${srcFontSize}px`,
        },
      };
      typography[[category, scale, 'line'].join('-')] = {
        value: lineHeight,
        attributes: {
          note: `${srcLineHeight}%`,
        },
      };
    });

  const typographyContent = JSON.stringify({
    text: {
      ...typography,
      'base-family': {
        value: 'UDShinGoPr6N, sans-serif',
      },
    },
  });

  // Generate Radius tokens
  console.log(Object.values(componentNodes).filter(({ document }) => document.name.includes('Radius'))[0].document.cornerRadius);
  const radius = {};
  Object.values(componentNodes)
    .filter(({ document }) => document.name.includes('Radius'))
    .forEach(({ document }) => {
      const name = 'radius' + '-' + document.name.split('/')[1].toLowerCase();
      const srcValue = document.cornerRadius;
      const value = Number(srcValue) / ROOT_FONT_SIZE;
      radius[name] = {
        value: value,
        attributes: {
          note: `${srcValue}px`,
        },
      };
    })
  
  const radiusContent = JSON.stringify({
    size: {
      ...radius,
    },
  });

  await writeFile(path.resolve(__dirname, '../tokens/color/primitive.json'), primitiveColorContent);
  await writeFile(path.resolve(__dirname, '../tokens/color/semantics.json'), semanticsColorContent);
  await writeFile(path.resolve(__dirname, '../tokens/size/spacing.json'), spacingContent);
  await writeFile(path.resolve(__dirname, '../tokens/text/typography.json'), typographyContent);
  await writeFile(path.resolve(__dirname, '../tokens/size/radius.json'), radiusContent);
  console.log('DONE');
};

main();
