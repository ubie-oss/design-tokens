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

const extractAttribute = (name, document) => {
  if (name.startsWith('border')) {
    return document.strokes[0];
  } else if (name.startsWith('text')){
    return document.children[0].fills[0];
  } else {
    return document.fills[0];
  }
}

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
    radius: {
      ...radius,
    },
  });

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
    icon: {
      ...icon,
    },
  });

  await writeFile(path.resolve(__dirname, '../tokens/color/primitive.json'), primitiveColorContent);
  await writeFile(path.resolve(__dirname, '../tokens/color/semantics.json'), semanticsColorContent);
  await writeFile(path.resolve(__dirname, '../tokens/size/spacing.json'), spacingContent);
  await writeFile(path.resolve(__dirname, '../tokens/text/typography.json'), typographyContent);
  await writeFile(path.resolve(__dirname, '../tokens/size/radius.json'), radiusContent);
  await writeFile(path.resolve(__dirname, '../tokens/size/icon.json'), iconContent);
  console.log('DONE');
};

main();
