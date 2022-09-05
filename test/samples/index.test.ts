/**
 * This file has been extracted and modified from Swagger UI.
 *
 * @license Apache-2.0
 * @see {@link https://github.com/swagger-api/swagger-ui/blob/master/test/unit/core/plugins/samples/fn.js}
 */
import type * as RMOAS from '../../src/rmoas.types';

import { expect } from 'chai';

import sampleFromSchema from '../../src/samples';

describe('sampleFromSchema', function () {
  it('should be memoized', async function () {
    const schema: RMOAS.SchemaObject = {
      type: 'string',
      format: 'date-time',
    };

    const firstRun = sampleFromSchema(schema);

    await new Promise(r => {
      setTimeout(r, 200);
    });

    expect(sampleFromSchema(schema)).to.deep.equal(firstRun);
  });

  it('returns object with no readonly fields for parameter', function () {
    const definition: RMOAS.SchemaObject = {
      type: 'object',
      properties: {
        id: {
          type: 'integer',
        },
        readOnlyDog: {
          readOnly: true,
          type: 'string',
        },
      },
    };

    expect(sampleFromSchema(definition, { includeReadOnly: false })).to.deep.equal({
      id: 0,
    });
  });

  it('returns object with readonly fields for parameter, with includeReadOnly', function () {
    const definition: RMOAS.SchemaObject = {
      type: 'object',
      properties: {
        id: {
          type: 'integer',
        },
        readOnlyDog: {
          readOnly: true,
          type: 'string',
          default: 'woof',
        },
      },
    };

    expect(sampleFromSchema(definition, { includeReadOnly: true })).to.deep.equal({
      id: 0,
      readOnlyDog: 'woof',
    });
  });

  it('returns object without deprecated fields for parameter', function () {
    const definition: RMOAS.SchemaObject = {
      type: 'object',
      properties: {
        id: {
          type: 'integer',
        },
        deprecatedProperty: {
          deprecated: true,
          type: 'string',
        },
      },
    };

    expect(sampleFromSchema(definition)).to.deep.equal({
      id: 0,
    });
  });

  it('returns object without writeonly fields for parameter', function () {
    const definition: RMOAS.SchemaObject = {
      type: 'object',
      properties: {
        id: {
          type: 'integer',
        },
        writeOnlyDog: {
          writeOnly: true,
          type: 'string',
        },
      },
    };

    expect(sampleFromSchema(definition)).to.deep.equal({
      id: 0,
    });
  });

  it('returns object with writeonly fields for parameter, with includeWriteOnly', function () {
    const definition: RMOAS.SchemaObject = {
      type: 'object',
      properties: {
        id: {
          type: 'integer',
        },
        writeOnlyDog: {
          writeOnly: true,
          type: 'string',
        },
      },
    };

    expect(sampleFromSchema(definition, { includeWriteOnly: true })).to.deep.equal({
      id: 0,
      writeOnlyDog: 'string',
    });
  });

  it('returns object without any $$ref fields at the root schema level', function () {
    const definition: RMOAS.SchemaObject = {
      type: 'object',
      properties: {
        message: {
          type: 'string',
        },
      },
      example: {
        value: {
          message: 'Hello, World!',
        },
        $$ref: '#/components/examples/WelcomeExample',
      },
      $$ref: '#/components/schemas/Welcome',
    };

    expect(sampleFromSchema(definition, { includeWriteOnly: true })).to.deep.equal({
      value: {
        message: 'Hello, World!',
      },
    });
  });

  it('returns object without any $$ref fields at nested schema levels', function () {
    const definition: RMOAS.SchemaObject = {
      type: 'object',
      properties: {
        message: {
          type: 'string',
        },
      },
      example: {
        a: {
          value: {
            message: 'Hello, World!',
          },
          $$ref: '#/components/examples/WelcomeExample',
        },
      },
      $$ref: '#/components/schemas/Welcome',
    };

    expect(sampleFromSchema(definition, { includeWriteOnly: true })).to.deep.equal({
      a: {
        value: {
          message: 'Hello, World!',
        },
      },
    });
  });

  it('returns object with any $$ref fields that appear to be user-created', function () {
    const definition: RMOAS.SchemaObject = {
      type: 'object',
      properties: {
        message: {
          type: 'string',
        },
      },
      example: {
        $$ref: {
          value: {
            message: 'Hello, World!',
          },
          $$ref: '#/components/examples/WelcomeExample',
        },
      },
      $$ref: '#/components/schemas/Welcome',
    };

    expect(sampleFromSchema(definition, { includeWriteOnly: true })).to.deep.equal({
      $$ref: {
        value: {
          message: 'Hello, World!',
        },
      },
    });
  });

  describe('primitive type handling', function () {
    it('should handle when an unknown type is detected', function () {
      const definition: RMOAS.SchemaObject = {
        type: 'array',
        // @ts-expect-error We're testing the failure case for `png` not being a valid type.
        items: {
          type: 'png',
        },
      };

      expect(sampleFromSchema(definition)).to.deep.equal(['Unknown Type: png']);
    });

    it('should return an undefined value for type=file', function () {
      const definition: RMOAS.SchemaObject = {
        type: 'array',
        // @ts-expect-error We're testing the failure case for `file` not being a valid type.
        items: {
          type: 'file',
        },
      };

      expect(sampleFromSchema(definition)).to.deep.equal([undefined]);
    });

    describe('type=boolean', function () {
      it('returns a boolean for a boolean', function () {
        const definition: RMOAS.SchemaObject = {
          type: 'boolean',
        };

        expect(sampleFromSchema(definition)).to.be.true;
      });

      it('returns a default value for a boolean with a default present', function () {
        const definition: RMOAS.SchemaObject = {
          type: 'boolean',
          default: false,
        };

        expect(sampleFromSchema(definition)).to.be.false;
      });
    });

    describe('type=number', function () {
      it('returns a number for a number with no format', function () {
        const definition: RMOAS.SchemaObject = {
          type: 'number',
        };

        expect(sampleFromSchema(definition)).to.equal(0);
      });

      it('returns a number for a number with format=float', function () {
        const definition: RMOAS.SchemaObject = {
          type: 'number',
          format: 'float',
        };

        expect(sampleFromSchema(definition)).to.equal(0.0);
      });

      it('returns a default value for a number with a default present', function () {
        const definition: RMOAS.SchemaObject = {
          type: 'number',
          default: 123,
        };

        expect(sampleFromSchema(definition)).to.equal(123);
      });
    });

    describe('type=string', function () {
      it('returns a date-time for a string with format=date-time', function () {
        const definition: RMOAS.SchemaObject = {
          type: 'string',
          format: 'date-time',
        };

        // 2022-01-24T21:26:50.058Z
        expect(sampleFromSchema(definition)).to.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/);
      });

      it('returns a date for a string with format=date', function () {
        const definition: RMOAS.SchemaObject = {
          type: 'string',
          format: 'date',
        };

        expect(sampleFromSchema(definition)).to.equal(new Date().toISOString().substring(0, 10));
      });

      it('returns a UUID for a string with format=uuid', function () {
        const definition: RMOAS.SchemaObject = {
          type: 'string',
          format: 'uuid',
        };

        expect(sampleFromSchema(definition)).to.equal('3fa85f64-5717-4562-b3fc-2c963f66afa6');
      });

      it('returns a hostname for a string with format=hostname', function () {
        const definition: RMOAS.SchemaObject = {
          type: 'string',
          format: 'hostname',
        };

        expect(sampleFromSchema(definition)).to.equal('example.com');
      });

      it('returns an IPv4 address for a string with format=ipv4', function () {
        const definition: RMOAS.SchemaObject = {
          type: 'string',
          format: 'ipv4',
        };

        expect(sampleFromSchema(definition)).to.equal('198.51.100.42');
      });

      it('returns an IPv6 address for a string with format=ipv6', function () {
        const definition: RMOAS.SchemaObject = {
          type: 'string',
          format: 'ipv6',
        };

        expect(sampleFromSchema(definition)).to.equal('2001:0db8:5b96:0000:0000:426f:8e17:642a');
      });

      it('returns an email for a string with format=email', function () {
        const definition: RMOAS.SchemaObject = {
          type: 'string',
          format: 'email',
        };

        expect(sampleFromSchema(definition)).to.equal('user@example.com');
      });

      it('returns a default value for a string with a default present', function () {
        const definition: RMOAS.SchemaObject = {
          type: 'string',
          default: 'test',
        };

        expect(sampleFromSchema(definition)).to.equal('test');
      });
    });
  });

  describe('type=undefined', function () {
    it('should handle if an object is present but is missing type=object', function () {
      const definition: RMOAS.SchemaObject = {
        properties: {
          foo: {
            type: 'string',
          },
        },
      };

      expect(sampleFromSchema(definition)).to.deep.equal({
        foo: 'string',
      });
    });

    it('should handle if an array is present but is missing type=array', function () {
      const definition: RMOAS.SchemaObject = {
        items: {
          type: 'string',
        },
      };

      expect(sampleFromSchema(definition)).to.deep.equal(['string']);
    });

    // Techncally this is a malformed schema, but we should do our best to support it.
    it('should handle if an array if present but is missing `items`', function () {
      const definition: RMOAS.SchemaObject = {
        type: 'array',
      };

      expect(sampleFromSchema(definition)).to.deep.equal([]);
    });

    it("should handle a case where no type is present and the schema can't be determined to be an object or array", function () {
      const definition: RMOAS.SchemaObject = {
        type: 'object',
        properties: {
          foo: {
            format: 'date',
          },
        },
      };

      expect(sampleFromSchema(definition)).to.deep.equal({
        foo: undefined,
      });
    });
  });

  describe('type=array', function () {
    it('returns array with sample of array type', function () {
      const definition: RMOAS.SchemaObject = {
        type: 'array',
        items: {
          type: 'integer',
        },
      };

      expect(sampleFromSchema(definition)).to.deep.equal([0]);
    });

    it('returns string for example for array that has example of type string', function () {
      const definition: RMOAS.SchemaObject = {
        type: 'array',
        items: {
          type: 'string',
        },
        example: 'dog',
      };

      expect(sampleFromSchema(definition)).to.equal('dog');
    });

    it('returns array of examples for array that has examples', function () {
      const definition: RMOAS.SchemaObject = {
        type: 'array',
        items: {
          type: 'string',
        },
        example: ['dog', 'cat'],
      };

      expect(sampleFromSchema(definition)).to.deep.equal(['dog', 'cat']);
    });

    it('returns array of samples for oneOf type', function () {
      const definition: RMOAS.SchemaObject = {
        type: 'array',
        items: {
          type: 'string',
          oneOf: [
            {
              type: 'integer',
            },
          ],
        },
      };

      expect(sampleFromSchema(definition)).to.deep.equal([0]);
    });

    it('returns array of samples for oneOf types', function () {
      const definition: RMOAS.SchemaObject = {
        type: 'array',
        items: {
          type: 'string',
          oneOf: [
            {
              type: 'string',
            },
            {
              type: 'integer',
            },
          ],
        },
      };

      expect(sampleFromSchema(definition)).to.deep.equal(['string', 0]);
    });

    it('returns array of samples for oneOf examples', function () {
      const definition: RMOAS.SchemaObject = {
        type: 'array',
        items: {
          type: 'string',
          oneOf: [
            {
              type: 'string',
              example: 'dog',
            },
            {
              type: 'integer',
              example: 1,
            },
          ],
        },
      };

      expect(sampleFromSchema(definition)).to.deep.equal(['dog', 1]);
    });

    it('returns array of samples for anyOf type', function () {
      const definition: RMOAS.SchemaObject = {
        type: 'array',
        items: {
          type: 'string',
          anyOf: [
            {
              type: 'integer',
            },
          ],
        },
      };

      expect(sampleFromSchema(definition)).to.deep.equal([0]);
    });

    it('returns array of samples for anyOf types', function () {
      const definition: RMOAS.SchemaObject = {
        type: 'array',
        items: {
          type: 'string',
          anyOf: [
            {
              type: 'string',
            },
            {
              type: 'integer',
            },
          ],
        },
      };

      expect(sampleFromSchema(definition)).to.deep.equal(['string', 0]);
    });

    it('returns array of samples for anyOf examples', function () {
      const definition: RMOAS.SchemaObject = {
        type: 'array',
        items: {
          type: 'string',
          anyOf: [
            {
              type: 'string',
              example: 'dog',
            },
            {
              type: 'integer',
              example: 1,
            },
          ],
        },
      };

      expect(sampleFromSchema(definition)).to.deep.equal(['dog', 1]);
    });

    it('returns null for a null example', function () {
      const definition: RMOAS.SchemaObject = {
        type: 'object',
        properties: {
          foo: {
            type: 'string',
            nullable: true,
            example: null,
          },
        },
      };

      expect(sampleFromSchema(definition)).to.deep.equal({
        foo: null,
      });
    });

    it('returns null for a null object-level example', function () {
      const definition: RMOAS.SchemaObject = {
        type: 'object',
        properties: {
          foo: {
            type: 'string',
            nullable: true,
          },
        },
        example: {
          foo: null,
        },
      };

      expect(sampleFromSchema(definition)).to.deep.equal({
        foo: null,
      });
    });
  });

  describe('additionalProperties', function () {
    it('returns object with additional props', function () {
      const definition: RMOAS.SchemaObject = {
        type: 'object',
        properties: {
          dog: {
            type: 'string',
          },
        },
        additionalProperties: {
          type: 'string',
        },
      };

      expect(sampleFromSchema(definition)).to.deep.equal({
        additionalProp: 'string',
        dog: 'string',
      });
    });

    it('returns object with additional props=true', function () {
      const definition: RMOAS.SchemaObject = {
        type: 'object',
        properties: {
          dog: {
            type: 'string',
          },
        },
        additionalProperties: true,
      };

      expect(sampleFromSchema(definition)).to.deep.equal({
        additionalProp: {},
        dog: 'string',
      });
    });

    it('returns object with 2 properties with no type passed but properties', function () {
      const definition: RMOAS.SchemaObject = {
        properties: {
          alien: {
            type: 'string',
          },
          dog: {
            type: 'integer',
          },
        },
      };

      expect(sampleFromSchema(definition)).to.deep.equal({
        alien: 'string',
        dog: 0,
      });
    });

    it('returns object with additional props with no type passed', function () {
      const definition: RMOAS.SchemaObject = {
        additionalProperties: {
          type: 'string',
        },
      };

      expect(sampleFromSchema(definition)).to.deep.equal({
        additionalProp: 'string',
      });
    });
  });

  describe('enums', function () {
    it('returns default value when enum provided', function () {
      const definition: RMOAS.SchemaObject = {
        type: 'string',
        default: 'one',
        enum: ['two', 'one'],
      };

      expect(sampleFromSchema(definition)).to.equal('one');
    });

    it('returns example value when provided', function () {
      const definition: RMOAS.SchemaObject = {
        type: 'string',
        default: 'one',
        example: 'two',
        enum: ['two', 'one'],
      };

      expect(sampleFromSchema(definition)).to.equal('two');
    });

    it('sets first enum if provided', function () {
      const definition: RMOAS.SchemaObject = {
        type: 'string',
        enum: ['one', 'two'],
      };

      expect(sampleFromSchema(definition)).to.equal('one');
    });

    // @todo this should really return `['1', '2']` as the expected data
    it('returns array with default values', function () {
      const definition = {
        items: {
          enum: ['one', 'two'],
          type: 'string',
        },
        default: ['1', '2'],
      };

      expect(sampleFromSchema(definition)).to.deep.equal(['one']);
    });
  });

  describe('polymorphism', function () {
    it('should handle an allOf schema', function () {
      const definition: RMOAS.SchemaObject = {
        allOf: [
          {
            type: 'object',
            properties: {
              name: {
                type: 'string',
              },
              tag: {
                type: 'string',
              },
            },
          },
          {
            type: 'object',
            properties: {
              id: {
                type: 'integer',
                format: 'int64',
              },
            },
          },
        ],
      };

      expect(sampleFromSchema(definition)).to.deep.equal({
        name: 'string',
        tag: 'string',
        id: 0,
      });
    });

    it('should grab properties from allOf polymorphism', function () {
      const polymorphismSchema: RMOAS.SchemaObject = {
        allOf: [
          {
            type: 'object',
            properties: {
              param1: {
                allOf: [
                  {
                    type: 'object',
                    properties: {
                      name: {
                        type: 'string',
                        example: 'Owlbert',
                      },
                    },
                  },
                ],
                type: 'object',
              },
              param2: {
                allOf: [
                  {
                    type: 'object',
                    properties: {
                      description: {
                        type: 'string',
                        example: 'Mascot of ReadMe',
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      };

      expect(sampleFromSchema(polymorphismSchema)).to.deep.equal({
        param1: {
          name: 'Owlbert',
        },
        param2: {
          description: 'Mascot of ReadMe',
        },
      });
    });

    it('should grab first property from anyOf/oneOf polymorphism', function () {
      const polymorphismSchema: RMOAS.SchemaObject = {
        allOf: [
          {
            type: 'object',
            properties: {
              param1: {
                allOf: [
                  {
                    type: 'object',
                    properties: {
                      name: {
                        type: 'string',
                        example: 'Owlbert',
                      },
                    },
                  },
                ],
                type: 'object',
              },
              param2: {
                anyOf: [
                  {
                    type: 'object',
                    properties: {
                      position: {
                        type: 'string',
                        example: 'Chief Whimsical Officer',
                      },
                    },
                  },
                  {
                    type: 'object',
                    properties: {
                      description: {
                        type: 'string',
                        example: 'Mascot of ReadMe',
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      };

      expect(sampleFromSchema(polymorphismSchema)).to.deep.equal({
        param1: {
          name: 'Owlbert',
        },
        param2: {
          position: 'Chief Whimsical Officer',
        },
      });
    });
  });
});
