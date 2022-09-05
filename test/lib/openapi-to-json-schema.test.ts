import type { SchemaObject } from '../../src/rmoas.types';
import type { JSONSchema4, JSONSchema7, JSONSchema7Definition, JSONSchema7TypeName } from 'json-schema';

import chai, { expect } from 'chai';
import { jestSnapshotPlugin } from 'mocha-chai-jest-snapshot';

import Oas from '../../src';
import toJSONSchema from '../../src/lib/openapi-to-json-schema';
import generateJSONSchemaFixture from '../__fixtures__/json-schema';

chai.use(jestSnapshotPlugin());

let petstore: Oas;

describe('openapi-to-json-schema', function () {
  before(async function () {
    petstore = await import('@readme/oas-examples/3.0/json/petstore.json').then(r => r.default).then(Oas.init);
    await petstore.dereference();
  });

  it('should preserve our `x-readme-ref-name` extension', function () {
    expect(
      toJSONSchema({
        type: 'object',
        properties: {
          id: { type: 'string', 'x-readme-ref-name': 'three' },
          'x-readme-ref-name': 'two',
        },
        'x-readme-ref-name': 'one',
      } as unknown)
    ).to.deep.equal({
      type: 'object',
      properties: {
        id: { type: 'string', 'x-readme-ref-name': 'three' },
        'x-readme-ref-name': 'two',
      },
      'x-readme-ref-name': 'one',
    });
  });

  describe('$ref pointers', function () {
    it('should ignore $ref pointers', function () {
      expect(toJSONSchema({ $ref: '#/components/schemas/pet' })).to.deep.equal({ $ref: '#/components/schemas/pet' });
    });

    it('should ignore $ref pointers that are deeply nested', function () {
      expect(
        toJSONSchema({
          type: 'object',
          properties: {
            id: {
              oneOf: [{ type: 'number' }, { $ref: '#/components/schemas/id' }],
            },
            breeds: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/breeds',
              },
            },
          },
        })
      ).to.deep.equal({
        type: 'object',
        properties: {
          id: {
            oneOf: [{ type: 'number' }, { $ref: '#/components/schemas/id' }],
          },
          breeds: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/breeds',
            },
          },
        },
      });
    });
  });

  describe('general quirks', function () {
    it('should convert a `true` schema to an empty object', function () {
      expect(toJSONSchema(true)).to.deep.equal({});
    });

    it('should handle object property members that are named "properties"', function () {
      const schema: SchemaObject = {
        type: 'object',
        properties: {
          name: {
            type: 'string',
          },
          properties: {
            type: 'object',
            properties: {
              tktk: {
                type: 'integer',
              },
            },
          },
        },
      };

      // What we're testing here is that we don't add a `type: object` adjacent to the
      // `properties`-named object property.
      expect(Object.keys(toJSONSchema(schema).properties)).to.deep.equal(['name', 'properties']);
    });

    describe('`type` funk', function () {
      it('should set a type to `object` if `type` is missing but `properties` is present', function () {
        const schema: SchemaObject = {
          properties: {
            name: {
              type: 'string',
            },
          },
        };

        expect(toJSONSchema(schema)).to.deep.equal({
          type: 'object',
          properties: {
            name: {
              type: 'string',
            },
          },
        });
      });

      it('should repair a malformed array that is missing `items` [README-8E]', function () {
        expect(toJSONSchema({ type: 'array' })).to.deep.equal({ type: 'array', items: {} });

        // Should work for a nested array as well.
        const schema: SchemaObject = toJSONSchema({
          type: 'array',
          items: {
            type: 'array',
          },
          description: '',
        });

        expect((schema as JSONSchema4 | JSONSchema7).items).to.deep.equal({
          type: 'array',
          items: {},
        });
      });

      it('should repair a malformed object that is typod as an array [README-6R]', function () {
        expect(
          toJSONSchema({ type: 'array', properties: { type: 'string' } } as {
            type: JSONSchema7TypeName;
            properties: { type: JSONSchema7Definition };
          })
        ).to.deep.equal({
          type: 'object',
          properties: {
            type: 'string',
          },
        });

        // Should work for a nested object as well.
        const schema: SchemaObject = {
          type: 'array',
          items: {
            type: 'array',
            properties: {
              name: {
                type: 'string',
              },
            },
            required: ['name'],
          },
        };

        expect(toJSONSchema(schema)).to.deep.equal({
          type: 'array',
          items: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
          },
        });
      });
    });

    describe('`type: object`', function () {
      it('should repair an object that has no `properties` or `additionalProperties`', function () {
        expect(toJSONSchema({ type: 'object' })).to.deep.equal({
          type: 'object',
          additionalProperties: true,
        });

        // Should work on for a nested object as well.
        const schema: SchemaObject = {
          type: 'object',
          properties: {
            host: {
              type: 'object',
            },
          },
        };

        expect(toJSONSchema(schema)).to.deep.equal({
          type: 'object',
          properties: {
            host: {
              type: 'object',
              additionalProperties: true,
            },
          },
        });
      });
    });
  });

  describe('polymorphism / inheritance', function () {
    // eslint-disable-next-line mocha/no-setup-in-describe
    ['allOf', 'anyOf', 'oneOf'].forEach(polyType => {
      it(`should support nested \`${polyType}\``, function () {
        const schema: SchemaObject = {
          properties: {
            nestedParam: {
              type: 'object',
              properties: {
                nestedParamProp: {
                  [polyType]: [
                    {
                      type: 'object',
                      properties: {
                        nestedNum: {
                          type: 'integer',
                        },
                      },
                    },
                    {
                      type: 'object',
                      properties: {
                        nestedString: {
                          type: 'string',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        };

        let expected;
        if (polyType === 'allOf') {
          expected = {
            type: 'object',
            properties: {
              nestedNum: { type: 'integer' },
              nestedString: { type: 'string' },
            },
          };
        } else {
          expected = {
            [polyType]: [
              {
                type: 'object',
                properties: { nestedNum: { type: 'integer' } },
              },
              {
                type: 'object',
                properties: { nestedString: { type: 'string' } },
              },
            ],
          };
        }

        expect((toJSONSchema(schema).properties.nestedParam as SchemaObject).properties.nestedParamProp).to.deep.equal(
          expected
        );
      });
    });

    // eslint-disable-next-line mocha/no-setup-in-describe
    ['allOf', 'anyOf', 'oneOf'].forEach(polyType => {
      it(`should not add a missing \`type\` on an \`${polyType}\` schema`, function () {
        const schema: SchemaObject = {
          [polyType]: [
            {
              title: 'range_query_specs',
              type: 'object',
              properties: {
                gt: {
                  type: 'integer',
                },
              },
            },
            {
              type: 'integer',
            },
          ],
        };

        expect(toJSONSchema(schema).type).to.be.undefined;
      });
    });

    describe('quirks', function () {
      it("should eliminate an `allOf` from a schema if it can't be merged", function () {
        const schema: SchemaObject = {
          title: 'allOf with incompatible schemas',
          allOf: [
            {
              type: 'string',
            },
            {
              type: 'integer',
            },
          ],
        };

        expect(toJSONSchema(schema)).to.deep.equal({
          title: 'allOf with incompatible schemas',
        });
      });

      it('should hoist `properties` into a same-level `oneOf` and transform each option into an `allOf`', function () {
        const schema: SchemaObject = {
          type: 'object',
          oneOf: [
            { title: 'Primitive is required', required: ['primitive'] },
            { title: 'Boolean is required', required: ['boolean'] },
          ],
          properties: {
            primitive: {
              type: 'string',
            },
            boolean: {
              type: 'boolean',
            },
          },
        };

        const propertiesSchema = {
          type: 'object',
          properties: {
            primitive: { type: 'string' },
            boolean: { type: 'boolean' },
          },
        };

        // Though this test is testing merging these properites into an `allOf`, we always merge
        // `allOf`'s when we can so this expected result won't contain one.
        expect(toJSONSchema(schema)).to.deep.equal({
          type: 'object',
          oneOf: [
            {
              title: 'Primitive is required',
              required: ['primitive'],
              ...propertiesSchema,
            },
            {
              title: 'Boolean is required',
              required: ['boolean'],
              ...propertiesSchema,
            },
          ],
        });
      });

      it('should hoist `items` into a same-level `oneOf` and transform each option into an `allOf`', function () {
        const schema: SchemaObject = {
          type: 'array',
          oneOf: [
            { title: 'Example', example: 'Pug' },
            { title: 'Alt Example', example: 'Buster' },
          ],
          items: {
            type: 'string',
          },
        };

        const itemsSchema = {
          type: 'array',
          items: { type: 'string' },
        };

        // Though this test is testing merging these properites into an `allOf`, we always merge
        // `allOf`'s when we can so this expected result won't contain one.
        expect(toJSONSchema(schema)).to.deep.equal({
          type: 'array',
          oneOf: [
            {
              title: 'Example',
              examples: ['Pug'],
              ...itemsSchema,
            },
            {
              title: 'Alt Example',
              examples: ['Buster'],
              ...itemsSchema,
            },
          ],
        });
      });

      describe('adding missing `type` properties', function () {
        it("should not add a `type` to a shapeless-description that's part of an `allOf`", function () {
          const schema: SchemaObject = {
            type: 'object',
            properties: {
              petIds: {
                allOf: [{ type: 'array', items: { type: 'string' } }, { description: 'Parameter description' }],
              },
            },
          };

          expect(toJSONSchema(schema).properties.petIds).to.deep.equal({
            type: 'array',
            description: 'Parameter description',
            items: { type: 'string' },
          });
        });

        // eslint-disable-next-line mocha/no-setup-in-describe
        ['anyOf', 'oneOf'].forEach(polyType => {
          it(`should not add a \`type\` to a shapeless-description that's part of an \`${polyType}\``, function () {
            const schema: SchemaObject = {
              type: 'object',
              properties: {
                petIds: {
                  [polyType]: [{ type: 'array', items: { type: 'string' } }, { description: 'Parameter description' }],
                },
              },
            };

            expect(toJSONSchema(schema).properties.petIds[polyType][1]).to.deep.equal({
              description: 'Parameter description',
            });
          });
        });
      });
    });
  });

  describe('`enum` support', function () {
    it('should support enums', function () {
      expect(toJSONSchema({ type: 'string', enum: ['cat', 'dog'] })).to.deep.equal({
        type: 'string',
        enum: ['cat', 'dog'],
      });

      // Should support nested objects as well.
      const schema: SchemaObject = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            petType: {
              type: 'string',
              enum: ['cat', 'dog'],
            },
          },
          required: ['petType'],
        },
      };

      expect(toJSONSchema(schema)).to.deep.equal(schema);
    });

    it('should fitler out duplicate items from an enum', function () {
      expect(toJSONSchema({ type: 'string', enum: ['cat', 'cat', 'dog', 'dog', 'snake'] })).to.deep.equal({
        type: 'string',
        enum: ['cat', 'dog', 'snake'],
      });
    });
  });

  describe('`format` support', function () {
    it('should support format', function () {
      expect(toJSONSchema({ type: 'integer', format: 'int8' })).to.deep.equal({
        type: 'integer',
        format: 'int8',
        minimum: -128,
        maximum: 127,
      });

      // Should support nested objects as well.
      const schema: SchemaObject = {
        type: 'array',
        items: {
          type: 'integer',
          format: 'int8',
        },
      };

      expect(toJSONSchema(schema)).to.deep.equal({
        type: 'array',
        items: {
          type: 'integer',
          format: 'int8',
          minimum: -128,
          maximum: 127,
        },
      });
    });

    describe('minimum / maximum constraints', function () {
      // eslint-disable-next-line mocha/no-setup-in-describe
      [
        ['integer', 'int8', -128, 127],
        ['integer', 'int16', -32768, 32767],
        ['integer', 'int32', -2147483648, 2147483647],
        ['integer', 'int64', 0 - 2 ** 63, 2 ** 63 - 1], // -9223372036854775808 to 9223372036854775807
        ['integer', 'uint8', 0, 255],
        ['integer', 'uint16', 0, 65535],
        ['integer', 'uint32', 0, 4294967295],
        ['integer', 'uint64', 0, 2 ** 64 - 1], // 0 to 1844674407370955161
        ['number', 'float', 0 - 2 ** 128, 2 ** 128 - 1], // -3.402823669209385e+38 to 3.402823669209385e+38
        // eslint-disable-next-line mocha/no-setup-in-describe
        ['number', 'double', 0 - Number.MAX_VALUE, Number.MAX_VALUE],
      ].forEach(([type, format, min, max]) => {
        describe(`\`type: ${type}\``, function () {
          describe(`\`format: ${format}\``, function () {
            it('should add a `minimum` and `maximum` if not present', function () {
              expect(toJSONSchema({ type: type as JSONSchema7TypeName, format: format as string })).to.deep.equal({
                type,
                format,
                minimum: min,
                maximum: max,
              });
            });

            it('should alter constraints if present and beyond the allowable points', function () {
              expect(
                toJSONSchema({
                  type: type as JSONSchema7TypeName,
                  format: format as string,
                  minimum: (min as number) ** 19,
                  maximum: (max as number) * 2,
                })
              ).to.deep.equal({
                type,
                format,
                minimum: min,
                maximum: max,
              });
            });

            it('should not touch their constraints if they are within their limits', function () {
              expect(
                toJSONSchema({ type: type as JSONSchema7TypeName, format: format as string, minimum: 0, maximum: 100 })
              ).to.deep.equal({
                type,
                format,
                minimum: 0,
                maximum: 100,
              });
            });
          });
        });
      });
    });
  });

  describe('`title` support`', function () {
    it('should support title', function () {
      const schema: SchemaObject = {
        oneOf: [
          {
            title: 'Dog',
            allOf: [
              {
                type: 'object',
                properties: {
                  breed: {
                    type: 'string',
                    enum: ['Dingo', 'Husky', 'Retriever', 'Shepherd'],
                  },
                },
              },
            ],
          },
        ],
      };

      expect(toJSONSchema(schema)).to.deep.equal(schema);
    });
  });

  describe('`additionalProperties` support', function () {
    // eslint-disable-next-line mocha/no-setup-in-describe
    [
      ['true', true],
      ['false', false],
      ['an empty object', true],
      ['an object containing a string', { type: 'string' } as { type: JSONSchema7TypeName }],
    ].forEach(([_, additionalProperties]) => {
      it(`should support additionalProperties when set to \`${_}\``, function () {
        const schema = {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties,
          },
        } as SchemaObject;

        expect(toJSONSchema(schema)).to.deep.equal({
          type: 'array',
          items: {
            type: 'object',
            additionalProperties,
          },
        });
      });
    });

    it('should support additionalProperties when set to an object that contains an array', function () {
      const schema: SchemaObject = {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                  format: 'int8',
                },
              },
            },
          },
        },
      };

      expect((toJSONSchema(schema) as JSONSchema4 | JSONSchema7).items).to.deep.equal({
        type: 'object',
        additionalProperties: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'integer',
                format: 'int8',
                minimum: -128,
                maximum: 127,
              },
            },
          },
        },
      });
    });
  });

  describe('`default` support', function () {
    it('should support default', function () {
      const schema: SchemaObject = generateJSONSchemaFixture({ default: 'example default' });
      expect(toJSONSchema(schema)).toMatchSnapshot();
    });

    it('should support a default of `false`', function () {
      const schema: SchemaObject = generateJSONSchemaFixture({ default: false });
      expect(toJSONSchema(schema)).toMatchSnapshot();
    });

    describe('`globalDefaults` option', function () {
      it('should add `globalDefaults` if there are matches', function () {
        const schema: SchemaObject = {
          type: 'object',
          properties: {
            id: { type: 'integer', format: 'int64', readOnly: true },
            category: {
              type: 'object',
              properties: {
                id: { type: 'integer', format: 'int64' },
                name: { type: 'string' },
              },
            },
            name: { type: 'string', example: 'doggie' },
          },
        };

        const globalDefaults = {
          id: 5678,
          categoryTypo: {
            id: 4,
            name: 'Testing',
          },
        };

        const compiled = toJSONSchema(schema, { globalDefaults });

        expect((compiled.properties.id as SchemaObject).default).to.equal(5678);
        expect((compiled.properties.category as SchemaObject).default).to.be.undefined;
      });
    });
  });

  describe('`allowEmptyValue` support', function () {
    it('should support allowEmptyValue', function () {
      const schema: SchemaObject = generateJSONSchemaFixture({ default: '', allowEmptyValue: true });
      expect(toJSONSchema(schema)).toMatchSnapshot();
    });
  });

  describe('`minLength` / `maxLength` support', function () {
    it('should support maxLength and minLength', function () {
      const schema: SchemaObject = {
        type: 'integer',
        minLength: 5,
        maxLength: 20,
      };

      expect(toJSONSchema(schema)).to.deep.equal({
        type: 'integer',
        minLength: 5,
        maxLength: 20,
      });
    });
  });

  describe('`deprecated` support', function () {
    it('should support deprecated', function () {
      const schema: SchemaObject = {
        type: 'integer',
        deprecated: true,
      };

      expect(toJSONSchema(schema)).to.deep.equal({
        type: 'integer',
        deprecated: true,
      });
    });
  });

  describe('`example` / `examples` support', function () {
    // eslint-disable-next-line mocha/no-setup-in-describe
    ['example', 'examples'].forEach(exampleProp => {
      describe(`defined within \`${exampleProp}\``, function () {
        function createExample(value) {
          if (exampleProp === 'example') {
            return value;
          }

          return {
            // Since this doesn't have a `value` that we can use we should ignore it.
            distinctExternal: {
              externalValue: 'https://example.com/example.example',
            },
            distinctExample: {
              value,
            },
          };
        }

        it('should pick up an example alongside a property', function () {
          const schema: SchemaObject = toJSONSchema({
            type: 'string',
            [exampleProp]: createExample('dog'),
          });

          expect(schema.examples).to.deep.equal(['dog']);
        });

        it('should allow falsy booleans', function () {
          const schema: SchemaObject = toJSONSchema({
            type: 'boolean',
            [exampleProp]: createExample(false),
          });

          expect(schema.examples).to.deep.equal([false]);
        });

        describe('should ignore non-primitives', function () {
          // eslint-disable-next-line mocha/no-setup-in-describe
          [
            ['array', [['dog']]],
            ['object', { type: 'dog' }],
          ].forEach(([_, value]) => {
            it(`${_}`, function () {
              const schema: SchemaObject = toJSONSchema({
                type: 'string',
                [exampleProp]: createExample(value),
              });

              expect(schema.examples).to.be.undefined;
            });
          });
        });

        it('should prefer and inherit a parent example (if present)', function () {
          const obj = {
            type: 'object',
            properties: {
              id: {
                type: 'integer',
                [exampleProp]: createExample(10),
              },
              name: {
                type: 'string',
              },
              categories: {
                type: 'array',
                items: {
                  type: 'string',
                },
                [exampleProp]: createExample(['hungry']),
              },
              tags: {
                type: 'object',
                properties: {
                  id: {
                    type: 'integer',
                  },
                  name: {
                    type: 'object',
                    properties: {
                      first: {
                        type: 'string',
                      },
                      last: {
                        type: 'string',
                      },
                    },
                  },
                },
                [exampleProp]: createExample({
                  name: {
                    last: 'dog',
                  },
                }),
              },
            },
            [exampleProp]: createExample({
              id: 100,
              name: {
                first: 'buster',
              },
              categories: 'lazy',
              tags: {
                id: 50,
              },
            }),
          };

          expect(toJSONSchema(obj as SchemaObject)).to.deep.equal({
            type: 'object',
            properties: {
              id: {
                type: 'integer',
                examples: [10],
              },
              name: {
                type: 'string',
              },
              categories: {
                type: 'array',
                items: {
                  type: 'string',
                },
                examples: ['hungry'],
              },
              tags: {
                type: 'object',
                properties: {
                  id: {
                    type: 'integer',

                    // Quirk: This is getting picked up as `100` as `id` exists in the root example and
                    // with the reverse search, is getting picked up over `tags.id`. This example
                    // should actually be 50.
                    examples: [100],
                  },
                  name: {
                    type: 'object',
                    properties: {
                      first: {
                        type: 'string',

                        // Quirk: This is getting picked up as `buster` as `name.first` exists in the
                        // root example and is geting picked up from the reverse example search. This
                        // property should not actually have an example present.
                        examples: ['buster'],
                      },
                      last: {
                        type: 'string',
                        examples: ['dog'],
                      },
                    },
                  },
                },
              },
            },
          });
        });

        it('should function through the normal workflow of retrieving a json schema and feeding it an initial example', function () {
          const operation = petstore.operation('/pet', 'post');
          const schema: SchemaObject = operation.getParametersAsJsonSchema()[0].schema;

          expect(schema.components).to.be.undefined;
          expect((schema.properties.id as SchemaObject).examples).to.deep.equal([25]);

          // Not `buster` because `doggie` is set directly alongside `name` in the definition.
          expect((schema.properties.name as SchemaObject).examples).to.deep.equal(['doggie']);
          expect(schema.properties.photoUrls).to.deep.equal({
            type: 'array',
            items: {
              type: 'string',
              examples: ['https://example.com/photo.png'],
            },
          });
        });
      });
    });

    it('should be able to pick up multiple primitive examples within an `example` prop', function () {
      const schema: SchemaObject = toJSONSchema({
        type: 'string',
        example: ['dog', 'cat', ['cow'], { horse: true }],
      });

      expect(schema.examples).to.deep.equal(['dog', 'cat']);
    });

    it('should be able to pick up multiple primitive examples within an `examples` prop', function () {
      const schema: SchemaObject = toJSONSchema({
        type: 'string',
        examples: {
          distinctName1: {
            value: 'dog',
          },
          distinctName2: {
            value: 'cat',
          },
        },
      } as unknown as SchemaObject);

      expect(schema.examples).to.deep.equal(['dog', 'cat']);
    });

    it('should catch thrown jsonpointer errors', async function () {
      const oas = new Oas({
        openapi: '3.0.0',
        info: {
          title: 'Test',
          version: '1.0.0',
        },
        paths: {
          '/': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        taxInfo: {
                          type: 'object',
                          nullable: true,
                          properties: {
                            url: {
                              type: 'string',
                              nullable: true,
                            },
                          },
                        },
                        price: {
                          type: 'integer',
                          format: 'int8',
                        },
                      },
                      example: {
                        // When attempting to search for an example on `taxInfo.url` jsonpointer will
                        // throw an error because `taxInfo` here is null.
                        taxInfo: null,
                        price: 1,
                      },
                    },
                    example: {
                      taxInfo: null,
                      price: 1,
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Success',
                },
              },
            },
          },
        },
      });

      await oas.dereference();

      const schema: SchemaObject = oas.operation('/', 'post').getParametersAsJsonSchema();
      expect(schema[0].schema).to.deep.equal({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
          taxInfo: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
              },
            },
          },
          price: {
            type: 'integer',
            format: 'int8',
            minimum: -128,
            maximum: 127,
            examples: [1],
          },
        },
      });
    });

    it('should not bug out if `examples` is an empty object', function () {
      const oas = new Oas({
        openapi: '3.0.0',
        info: {
          title: 'Test',
          version: '1.0.0',
        },
        paths: {
          '/': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        limit: {
                          type: 'integer',
                        },
                      },
                    },
                    examples: {},
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Success',
                },
              },
            },
          },
        },
        components: {},
      });

      const schema: SchemaObject = oas.operation('/', 'post').getParametersAsJsonSchema();
      expect(schema[0].schema).to.deep.equal({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: { limit: { type: 'integer' } },
      });
    });
  });
});
