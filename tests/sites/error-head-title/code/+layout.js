import { html } from "@amitkaps/sitez";

export const head = () => html`
  <link rel="icon" href="data:," />
  <title>Home | Head title</title>
`;

export default ({ children }) => html`<main>${children}</main>`;
