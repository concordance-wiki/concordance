import type { JSX } from "preact";

import type { Attribute, AttributeValue } from "../../slots.js";

export function Value({ value }: { value: AttributeValue }): JSX.Element {
  return value.href === undefined ? (
    <span class="value">{value.text}</span>
  ) : (
    <a class="value" href={value.href}>
      {value.text}
    </a>
  );
}

/** Declared metadata as a description list, one term per attribute. */
export function AttributeList({ attributes }: { attributes: Attribute[] }): JSX.Element {
  return (
    <dl class="attributes">
      {attributes.map((attribute) => (
        <div key={attribute.name} class="attribute">
          <dt>{attribute.label}</dt>
          {attribute.values.map((value, index) => (
            <dd key={index}>
              <Value value={value} />
            </dd>
          ))}
        </div>
      ))}
    </dl>
  );
}
