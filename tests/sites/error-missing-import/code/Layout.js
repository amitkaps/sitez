import { html } from "sitez";
import Card from "./_card.js";

export default ({ children }) => html`<main>${children}</main>${Card()}`;
