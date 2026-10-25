import { loadModule } from "./loader.js";

/** React as the Host provides it. */
export const react = loadModule("react");

/** The element factory every component in this package uses. */
export const h = react.createElement;
