import type { JSX } from "preact";

import type { Attribute, AttributeValue, EntityRef } from "../../slots.js";
import { useAttributePart } from "../context.js";

export function Value({ value }: { value: AttributeValue }): JSX.Element {
  return value.href === undefined ? (
    <span class="value">{value.text}</span>
  ) : (
    <a class="value" href={value.href}>
      {value.text}
    </a>
  );
}

/** The values of an attribute, through the `Attribute@<name>` component of the theme or of the type module when one exists. */
export function AttributeValues({
  entity,
  attribute,
}: {
  entity: EntityRef;
  attribute: Attribute;
}): JSX.Element {
  const Part = useAttributePart(entity.type, attribute.name);
  if (Part !== undefined) {
    return <Part entity={entity} attribute={attribute} />;
  }
  return (
    <>
      {attribute.values.map((value, index) => (
        <Value key={index} value={value} />
      ))}
    </>
  );
}

/** Attributes as a description list, one term per attribute, the values inside one definition when a part renders them. */
export function AttributeList({
  entity,
  attributes,
}: {
  entity: EntityRef;
  attributes: Attribute[];
}): JSX.Element {
  return (
    <dl class="attributes">
      {attributes.map((attribute) => (
        <div key={attribute.name} class="attribute">
          <dt>{attribute.label}</dt>
          <dd>
            <AttributeValues entity={entity} attribute={attribute} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
