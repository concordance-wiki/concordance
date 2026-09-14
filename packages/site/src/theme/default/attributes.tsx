import type { JSX } from "preact";

import type { Attribute, AttributeValue, EntityRef } from "../../slots.js";
import { useAttributePart } from "../context.js";

/** A separator between two values, so that a list reads as one whatever the stylesheet. */
export const VALUE_SEPARATOR = ", ";

/** A value with a note stands out, in italics, and says why on hovering. */
function valueClass(value: AttributeValue): string {
  return value.note === undefined ? "value" : "value value-noted";
}

export function Value({
  value,
  separated = false,
}: {
  value: AttributeValue;
  /** Whether a separator precedes the value: every value but the first of a list. */
  separated?: boolean;
}): JSX.Element {
  return (
    <>
      {separated && VALUE_SEPARATOR}
      {value.href === undefined ? (
        <span class={valueClass(value)} title={value.note}>
          {value.text}
        </span>
      ) : (
        <a class={valueClass(value)} href={value.href} title={value.note}>
          {value.text}
        </a>
      )}
    </>
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
        <Value key={value.href ?? value.text} value={value} separated={index > 0} />
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
