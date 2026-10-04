import { html } from "sitez";
import teachings from "../data/teachings.json" with { type: "json" };

const upper = (value) => (value ?? "").toUpperCase();

// Each item names both its category and its type in data-filter, since the
// Jekyll page filtered on either with one set of buttons.
export default () => html`
  <section class="wide">
    <div class="grid">
      ${teachings.map(
        (item) => html`
          <a
            class="grid-item teaching ${item.category} ${item.type}"
            data-filter="${item.category} ${item.type}"
            href=${item.link}
          >
            <p class="first"><strong>${item.topic}</strong></p>
            <p class="second">${item.client}</p>
            <p class="third">${upper(item.location)}</p>
            <div class="right-1">${upper(item.month)}/${item.year}</div>
            <div class="right-2">${upper(item.category)}</div>
            <div class="left-1">${upper(item.type)}</div>
            <div class="left-2">${upper(item.duration)}</div>
          </a>
        `,
      )}
    </div>
  </section>
`;
