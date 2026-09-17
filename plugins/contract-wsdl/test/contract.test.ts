import { describe, expect, it } from "vitest";

import { isWsdlRoot, readWsdl } from "../src/contract.js";
import { forgeBridge, members, orders } from "./fixtures.js";

function contract(text: string, location = "service.wsdl") {
  const read = readWsdl(text, location);
  if ("error" in read) throw new Error(read.error);
  return read;
}

describe("readWsdl", () => {
  it("reports a deployment document that imports its port types and declares no operation, instead of an empty contract", () => {
    const deployment =
      '<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:tns="urn:x" targetNamespace="urn:x">' +
      '<import namespace="urn:x" location="core.wsdl"/>' +
      '<binding name="B" type="tns:P"/>' +
      '<service name="S"><port name="Q" binding="tns:B"/></service>' +
      "</definitions>";
    expect(readWsdl(deployment, "deploy.wsdl")).toEqual({
      error:
        "deploy.wsdl declares no operation of its own and imports another document, which is not followed: point the note at the document that declares the port types",
    });
    const empty = '<definitions xmlns="http://schemas.xmlsoap.org/wsdl/"></definitions>';
    expect(contract(empty).operations).toEqual([]);
  });

  it("reads a WSDL 1.1 document: its documentation as title, no version, and one operation per port type operation, sorted", () => {
    const read = contract(orders);
    expect(read.wsdl).toBe("1.1");
    expect(read.title).toBe("Orders API");
    expect(read.version).toBe("");
    expect(read.operations.map((o) => [o.interface, o.name])).toEqual([
      ["AdminPortType", "cancelOrder"],
      ["OrdersPortType", "cancelOrder"],
      ["OrdersPortType", "placeOrder"],
    ]);
  });

  it("carries the first port by service and port name whose binding binds the port type, with the binding name", () => {
    const [admin, cancel, place] = contract(orders).operations;
    expect(place).toMatchObject({ port: "OrdersPort", binding: "OrdersSoapBinding" });
    expect(cancel).toMatchObject({ port: "OrdersPort", binding: "OrdersSoapBinding" });
    expect(admin !== undefined && "port" in admin).toBe(false);
    expect(admin !== undefined && "binding" in admin).toBe(false);
  });

  it("reads the soapAction of the bound operation and leaves an empty or missing one absent", () => {
    const [admin, cancel, place] = contract(orders).operations;
    expect(place?.soapAction).toBe("urn:example:orders:placeOrder");
    expect(cancel !== undefined && "soapAction" in cancel).toBe(false);
    expect(admin !== undefined && "soapAction" in admin).toBe(false);
  });

  it("reads the documentation of an operation with its whitespace collapsed and leaves an empty one absent", () => {
    const [admin, cancel, place] = contract(orders).operations;
    expect(place?.documentation).toBe("Place an order across several lines");
    expect(cancel !== undefined && "documentation" in cancel).toBe(false);
    expect(admin !== undefined && "documentation" in admin).toBe(false);
  });

  it("collects the XSD elements and complex types the messages reference, walking the inline schema and keeping imported names as written", () => {
    const [admin, cancel, place] = contract(orders).operations;
    expect(place?.types).toEqual([
      "Line",
      "Note",
      "Order",
      "OrderAck",
      "OrderLine",
      "placeOrder",
      "placeOrderResponse",
    ]);
    expect(cancel?.types).toEqual(["Reason", "cancelOrderResponse"]);
    expect(admin?.types).toEqual([]);
  });

  it("reads a WSDL 2.0 document: interface operations with their endpoint, binding, action, documentation and element references", () => {
    const read = contract(members);
    expect(read).toEqual({
      wsdl: "2.0",
      title: "Members API",
      version: "",
      operations: [
        {
          name: "getMember",
          interface: "MembersInterface",
          port: "MembersEndpoint",
          binding: "MembersSoapBinding",
          soapAction: "urn:example:members:getMember",
          documentation: "Read a member",
          types: ["Member", "MemberQuery", "getMember", "member"],
          input: "getMember",
          output: "member",
          faults: [],
        },
        {
          name: "ping",
          interface: "MembersInterface",
          port: "MembersEndpoint",
          binding: "MembersSoapBinding",
          types: [],
          faults: [],
        },
      ],
      types: [
        { name: "Member", fields: [{ name: "name", type: "string", required: true }] },
        { name: "MemberQuery", fields: [{ name: "id", type: "string", required: true }] },
        {
          name: "getMember",
          type: "MemberQuery",
          fields: [{ name: "id", type: "string", required: true }],
        },
        {
          name: "member",
          type: "Member",
          fields: [{ name: "name", type: "string", required: true }],
        },
      ],
    });
  });

  it("falls back to the name of the definitions for the title, then to an empty title", () => {
    expect(contract(forgeBridge).title).toBe("Forge bridge");
    expect(contract('<definitions name="Svc"/>').title).toBe("Svc");
    expect(contract("<definitions/>")).toEqual({
      wsdl: "1.1",
      title: "",
      version: "",
      operations: [],
      types: [],
    });
  });

  it("names what each operation exchanges: the element of a single part, the parts of a message with several, the faults", () => {
    const [admin, cancel, place] = contract(orders).operations;
    expect(place).toMatchObject({
      input: "placeOrder",
      output: "placeOrderResponse",
      faults: [{ name: "failure", type: "Note" }],
    });
    expect(cancel).toMatchObject({
      input: "orderId: string, reason: Reason, untyped: any",
      output: "cancelOrderResponse",
      faults: [],
    });
    expect(admin !== undefined && "input" in admin).toBe(false);
    expect(admin !== undefined && "output" in admin).toBe(false);
  });

  it("describes the inline elements and complex types the operations reference: fields, requirement, derivation base and documentation", () => {
    expect(contract(orders).types).toEqual([
      { name: "Line", fields: [{ name: "sku", type: "string", required: true }] },
      { name: "Note", type: "string", fields: [] },
      {
        name: "Order",
        fields: [
          { name: "customer", type: "Customer", required: true },
          { name: "status", type: "Status", required: true },
          { name: "lines", type: "OrderLine", required: true },
        ],
      },
      { name: "OrderAck", fields: [{ name: "order", type: "Order", required: true }] },
      {
        name: "OrderLine",
        fields: [
          { name: "sku", type: "string", required: true },
          { name: "quantity", type: "int", required: true },
        ],
      },
      {
        name: "placeOrder",
        fields: [
          { name: "order", type: "Order", required: true },
          { name: "Note", type: "Note", required: false },
        ],
      },
      {
        name: "placeOrderResponse",
        type: "OrderAck",
        fields: [{ name: "order", type: "Order", required: true }],
      },
    ]);
  });

  it("reads attributes, anonymous elements, documented fields, a base that is no complex type and a derivation cycle", () => {
    const text = `<definitions xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:tns="urn:t">
      <types>
        <xsd:schema>
          <xsd:complexType name="Report">
            <xsd:annotation><xsd:documentation>A build   report</xsd:documentation></xsd:annotation>
            <xsd:complexContent>
              <xsd:extension base="tns:Report">
                <xsd:sequence>
                  <xsd:element name="lines"><xsd:complexType><xsd:sequence><xsd:element name="hidden" type="xsd:string"/></xsd:sequence></xsd:complexType></xsd:element>
                  <xsd:element name="verdict" type="tns:Verdict">
                    <xsd:annotation><xsd:documentation>The fail-on verdict</xsd:documentation></xsd:annotation>
                  </xsd:element>
                </xsd:sequence>
                <xsd:attribute name="id" type="xsd:string" use="required"/>
                <xsd:attribute name="stale" type="xsd:boolean"/>
                <xsd:element/>
              </xsd:extension>
            </xsd:complexContent>
          </xsd:complexType>
          <xsd:complexType name="Verdict">
            <xsd:simpleContent><xsd:restriction base="xsd:string"/></xsd:simpleContent>
          </xsd:complexType>
          <xsd:complexType name="Baseless">
            <xsd:complexContent><xsd:extension><xsd:sequence/></xsd:extension></xsd:complexContent>
          </xsd:complexType>
          <xsd:element name="report" type="tns:Report"/>
          <xsd:element name="missingType" type="tns:Elsewhere"/>
          <xsd:element name="baseless" type="tns:Baseless"/>
        </xsd:schema>
      </types>
      <message name="in"><part name="body" element="tns:report"/></message>
      <message name="out"><part name="body" element="tns:missingType"/></message>
      <message name="baselessOut"><part name="body" element="tns:baseless"/></message>
      <portType name="P">
        <operation name="fetchReport"><input message="tns:in"/><output message="tns:out"/><fault/><outfault ref="tns:Overflow"/></operation>
        <operation name="pushReport"><output message="tns:baselessOut"/></operation>
      </portType>
    </definitions>`;
    const read = contract(text);
    expect(read.operations.map((operation) => [operation.input, operation.output])).toEqual([
      ["report", "missingType"],
      [undefined, "baseless"],
    ]);
    expect(read.operations[0]?.faults).toEqual([{ name: "" }, { name: "Overflow" }]);
    const reportFields = [
      { name: "lines", type: "anonymous", required: true },
      { name: "verdict", type: "Verdict", required: true, description: "The fail-on verdict" },
      { name: "id", type: "string", required: true },
      { name: "stale", type: "boolean", required: false },
      { name: "", type: "anonymous", required: true },
    ];
    expect(read.types).toEqual([
      { name: "Baseless", fields: [] },
      { name: "Report", description: "A build report", fields: reportFields },
      { name: "Verdict", fields: [] },
      { name: "baseless", type: "Baseless", fields: [] },
      { name: "missingType", type: "Elsewhere", fields: [] },
      { name: "report", type: "Report", fields: reportFields },
    ]);
  });

  it("reports malformed XML with the reason and the line, naming the location", () => {
    expect(readWsdl("<definitions><portType></definitions>", "broken.wsdl")).toEqual({
      error:
        "broken.wsdl is not well-formed XML: Expected closing tag 'portType' (opened in line 1, col 14) instead of closing tag 'definitions'. (line 1)",
    });
    expect(readWsdl("", "empty.wsdl")).toEqual({
      error: "empty.wsdl is not well-formed XML: Start tag expected. (line 1)",
    });
  });

  it("refuses a document with a DOCTYPE before expanding anything, the entity bomb the parser would otherwise throw on", () => {
    const entities = Array.from({ length: 1001 }, (_, i) => `<!ENTITY e${String(i)} "x">`).join("");
    const bomb = `<!DOCTYPE definitions [${entities}]><definitions xmlns="http://schemas.xmlsoap.org/wsdl/"/>`;
    expect(readWsdl(bomb, "bomb.wsdl")).toEqual({
      error: "bomb.wsdl is not well-formed XML: DOCTYPE declarations are not read",
    });
    expect(
      readWsdl(
        '<!doctype definitions><definitions xmlns="http://schemas.xmlsoap.org/wsdl/"/>',
        "d.wsdl",
      ),
    ).toEqual({ error: "d.wsdl is not well-formed XML: DOCTYPE declarations are not read" });
  });

  it("refuses a well-formed XML document that is not a WSDL", () => {
    expect(readWsdl('<?xml version="1.0"?>\n<xs:schema xmlns:xs="x"/>', "types.xsd")).toEqual({
      error:
        "types.xsd is not a WSDL document: the root element is schema, not definitions or description",
    });
  });
});

describe("isWsdlRoot", () => {
  it("accepts the root of a WSDL 1.1 or 2.0 document and nothing else", () => {
    expect(isWsdlRoot("definitions")).toBe(true);
    expect(isWsdlRoot("description")).toBe(true);
    expect(isWsdlRoot("schema")).toBe(false);
    expect(isWsdlRoot("toString")).toBe(false);
    expect(isWsdlRoot(undefined)).toBe(false);
  });
});
