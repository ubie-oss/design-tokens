const fs = require("fs");
const { promisify } = require("util");
const path = require("path");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const writeFile = promisify(fs.writeFile);

const TOKEN = process.env.FIGMA_TOKEN;
const FIGMA_FILE_KEY = process.env.FIGMA_DESIGN_TOKEN_FILE_KEY;
const PREFIX = "Ubie";

const fetchFigma = (path) =>
  fetch(`https://api.figma.com/v1/files/${FIGMA_FILE_KEY}${path}`, {
    headers: {
      "X-FIGMA-TOKEN": TOKEN,
    },
  }).then((response) => response.json());

const rgbaToHex = (r, g, b, a) => {
  const hr = Math.round(r).toString(16);
  const hg = Math.round(g).toString(16);
  const hb = Math.round(b).toString(16);
  const ha = !a ? "" : Math.round(a * 255).toString(16);

  return `#${hr.length === 1 ? `0${hr}` : hr}${
    hg.length === 1 ? `0${hg}` : hg
  }${hb.length === 1 ? `0${hb}` : hb}${ha.length === 1 ? `0${ha}` : ha}`;
};
const main = async () => {
  const responseStyles = await fetchFigma("/styles");
  const styles = responseStyles.meta.styles;

  const nodeIds = styles.map((style) => style.node_id);
  const nodeIdsQuery = nodeIds.join(",");

  const { nodes } = await fetchFigma(`/nodes?ids=${nodeIdsQuery}`);

  const primitiveColors = {};

  Object.values(nodes)
    .filter(({ document }) => document.name.includes("Primitive"))
    .forEach(({ document }) => {
      const { opacity, color } = document.fills[0];
      const { r, g, b } = color;
      const hex = rgbaToHex(r * 255, g * 255, b * 255, opacity);
      const colorName = document.name.split("/")[1];
      const colorNameArr = colorName.split(" ");
      if (colorName.split(" ").length === 2) {
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

  Object.values(nodes)
    .filter(({ document }) => document.name.includes("Semantics"))
    .forEach(({ document }) => {
      const { opacity, color } = document.fills[0];
      const { r, g, b } = color;
      const colorName = document.name.split("/")[1];
      const style = styles.find((s) => s.name.includes(colorName));
      const reference = style.description;
      semanticColors[colorName.replaceAll(" ", "")] = {
        value: !reference
          ? rgbaToHex(r * 255, g * 255, b * 255, opacity)
          : `{${reference.replaceAll(" ", ".")}.value}`,
      };
    });

  const primitiveColorContent = JSON.stringify({
    [PREFIX]: {
      ...primitiveColors,
    },
  });

  const semanticsColorContent = JSON.stringify({
    Color: {
      ...semanticColors,
    },
  });

  await writeFile(
    path.resolve(__dirname, "../tokens/color/primitive.json"),
    primitiveColorContent
  );
  await writeFile(
    path.resolve(__dirname, "../tokens/color/semantics.json"),
    semanticsColorContent
  );
  console.log("DONE");
};

main();
