const fs = require('fs');
const { promisify } = require('util');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const writeFile = promisify(fs.writeFile);

const TOKEN = process.env.FIGMA_TOKEN;
const FIGMA_FILE_KEY = process.env.FIGMA_DESIGN_TOKEN_FILE_KEY;
const PREFIX = 'Ubie';
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
    .forEach(({ document }) => {
      const { opacity, color } = document.fills[0];
      const { r, g, b } = color;
      const hex = rgbaToHex(r * 255, g * 255, b * 255, opacity);
      const colorNameArr = document.name.split('/').slice(1);
      if (colorNameArr.length === 2) {
        // ex: "Ubie/White"
        primitiveColors[colorNameArr[1]] = {
          value: hex,
        };
      } else {
        primitiveColors[colorNameArr[1]] = {
          ...primitiveColors[colorNameArr[1]],
          [colorNameArr[2]]: {
            value: hex,
          },
        };
      }
    });

  const semanticColors = {};

  Object.values(styleNodes)
    .filter(({ document }) => document.name.includes('Semantic'))
    .forEach(({ document }) => {
      const { opacity, color } = document.fills[0];
      const { r, g, b } = color;
      const colorName = document.name.split('/').slice(1).join(' ');
      const style = styles.find((s) => s.name === document.name);
      const reference = style.description;
      semanticColors[colorName] = {
        value: !reference
          ? rgbaToHex(r * 255, g * 255, b * 255, opacity)
          : `{color.${reference.replaceAll(' ', '.')}.value}`,
      };
    });

  const primitiveColorContent = JSON.stringify({
    color: {
      [PREFIX]: {
        ...primitiveColors,
      },
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
      const name = document.name.split('/')[1].toLowerCase();
      const value = Number(document.absoluteBoundingBox.width) / ROOT_FONT_SIZE;
      spacings[name] = {
        value: value,
      };
    });

  const spacingContent = JSON.stringify({
    size: {
      Spacing: {
        ...spacings,
      },
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
      const lineHeight = document.style.lineHeightPercentFontSize / 100;
      const fontSize = document.style.fontSize / ROOT_FONT_SIZE + 'rem';

      if (category in typography) {
        typography[category][scale] = {
          line: {
            value: lineHeight,
          },
          size: {
            value: fontSize,
          },
        };
      } else {
        typography[category] = {
          [scale]: {
            line: {
              value: lineHeight,
            },
            size: {
              value: fontSize,
            },
          },
        };
      }
    });

  const typographyContent = JSON.stringify({
    text: {
      ...typography,
      base: {
        family: {
          value: 'UDShinGoPr6N, sans-serif',
        },
      },
    },
  });

  await writeFile(path.resolve(__dirname, '../tokens/color/primitive.json'), primitiveColorContent);
  await writeFile(path.resolve(__dirname, '../tokens/color/semantics.json'), semanticsColorContent);
  await writeFile(path.resolve(__dirname, '../tokens/size/spacing.json'), spacingContent);
  await writeFile(path.resolve(__dirname, '../tokens/text/typography.json'), typographyContent);
  console.log('DONE');
};

main();
