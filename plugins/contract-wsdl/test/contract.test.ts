import { describe, expect, it } from "vitest";

import { isWsdlRoot, readWsdl } from "../src/contract.js";
import { forgeBridge, members, orders } from "./fixtures.js";

function contract(text: string, location = "service.wsdl") {
  const read = readWsdl(text, location);
  if ("error" in read) throw new Error(read.error);
  return read;
}

describe("readWsdl", () => {
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
        },
        {
          name: "ping",
          interface: "MembersInterface",
          port: "MembersEndpoint",
          binding: "MembersSoapBinding",
          types: [],
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
    });
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
