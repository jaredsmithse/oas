import type { OperationObject, RequestBodyObject, SchemaObject } from '../../src/rmoas.types';

import chai, { expect } from 'chai';
import { jestSnapshotPlugin } from 'mocha-chai-jest-snapshot';

import Oas from '../../src';
import createOas from '../__fixtures__/create-oas';

chai.use(jestSnapshotPlugin());

let discriminators: Oas;
let parametersCommon: Oas;
let petstore: Oas;
let petstore_31: Oas;
let petstoreServerVars: Oas;
let deprecated: Oas;
let polymorphismQuirks: Oas;

describe('#getParametersAsJsonSchema', function () {
  before(async function () {
    discriminators = await import('../__datasets__/discriminators.json').then(r => r.default).then(Oas.init);
    await discriminators.dereference();

    parametersCommon = await import('../__datasets__/parameters-common.json').then(r => r.default).then(Oas.init);
    await parametersCommon.dereference();

    petstore = await import('@readme/oas-examples/3.0/json/petstore.json').then(r => r.default).then(Oas.init);
    await petstore.dereference();

    petstore_31 = await import('@readme/oas-examples/3.1/json/petstore.json').then(r => r.default).then(Oas.init);
    await petstore_31.dereference();

    petstoreServerVars = await import('../__datasets__/petstore-server-vars.json').then(r => r.default).then(Oas.init);
    await petstoreServerVars.dereference();

    deprecated = await import('../__datasets__/schema-deprecated.json').then(r => r.default).then(Oas.init);
    await deprecated.dereference();

    polymorphismQuirks = await import('../__datasets__/polymorphism-quirks.json').then(r => r.default).then(Oas.init);
    await polymorphismQuirks.dereference();
  });

  it('it should return with null if there are no parameters', function () {
    expect(createOas({ parameters: [] }).operation('/', 'get').getParametersAsJsonSchema()).to.be.null;
    expect(createOas({}).operation('/', 'get').getParametersAsJsonSchema()).to.be.null;
  });

  describe('type sorting', function () {
    const operation: OperationObject = {
      parameters: [
        { in: 'path', name: 'path parameter', schema: { type: 'string' } },
        { in: 'query', name: 'query parameter', schema: { type: 'string' } },
        { in: 'header', name: 'header parameter', schema: { type: 'string' } },
        { in: 'cookie', name: 'cookie parameter', schema: { type: 'string' } },
      ],
      requestBody: {
        description: 'Body description',
        content: {},
      },
    };

    it('should return with a json schema for each parameter type (formData instead of body)', function () {
      (operation.requestBody as RequestBodyObject).content = {
        'application/x-www-form-urlencoded': {
          schema: {
            type: 'object',
            properties: { a: { type: 'string' } },
          },
        },
      };

      const oas = createOas(operation);
      const jsonschema = oas.operation('/', 'get').getParametersAsJsonSchema();

      expect(jsonschema).toMatchSnapshot();
      expect(
        jsonschema.map(js => {
          return js.type;
        })
      ).to.deep.equal(['path', 'query', 'cookie', 'formData', 'header']);
    });

    it('should return with a json schema for each parameter type (body instead of formData)', function () {
      (operation.requestBody as RequestBodyObject).content = {
        'application/json': {
          schema: {
            type: 'object',
            properties: { a: { type: 'string' } },
          },
        },
      };

      const oas = createOas(operation);
      const jsonschema = oas.operation('/', 'get').getParametersAsJsonSchema();

      expect(jsonschema).toMatchSnapshot();
      expect(
        jsonschema.map(js => {
          return js.type;
        })
      ).to.deep.equal(['path', 'query', 'body', 'cookie', 'header']);
    });
  });

  describe('$schema version', function () {
    it('should add the v4 schema version to OpenAPI 3.0.x schemas', function () {
      expect(petstore.operation('/pet', 'post').getParametersAsJsonSchema()[0].schema.$schema).to.equal(
        'http://json-schema.org/draft-04/schema#'
      );
    });

    it('should add v2020-12 schema version on OpenAPI 3.1 schemas', function () {
      expect(petstore_31.operation('/pet', 'post').getParametersAsJsonSchema()[0].schema.$schema).to.equal(
        'https://json-schema.org/draft/2020-12/schema#'
      );
    });
  });

  describe('parameters', function () {
    it('should convert parameters to JSON schema', function () {
      const operation = petstore.operation('/pet/{petId}', 'delete');
      expect(operation.getParametersAsJsonSchema()).toMatchSnapshot();
    });

    describe('polymorphism', function () {
      it('should merge allOf schemas together', function () {
        const operation = polymorphismQuirks.operation('/allof-with-empty-object-property', 'post');
        expect(operation.getParametersAsJsonSchema()).toMatchSnapshot();
      });
    });

    describe('`content` support', function () {
      it('should support `content` on parameters', function () {
        const oas = createOas({
          parameters: [
            {
              name: 'userId',
              description: 'Filter the data by userId',
              in: 'query',
              content: { 'application/json': { schema: { type: 'string' } } },
            },
          ],
        });

        const schema = oas.operation('/', 'get').getParametersAsJsonSchema();
        expect(schema[0].schema.properties.userId).to.deep.equal({
          $schema: 'http://json-schema.org/draft-04/schema#',
          type: 'string',
          description: 'Filter the data by userId',
        });
      });

      it('should prioritize `application/json` if present', function () {
        const oas = createOas({
          parameters: [
            {
              name: 'userId',
              in: 'query',
              content: {
                'application/json': { schema: { type: 'integer' } },
                'application/xml': { schema: { type: 'string' } },
              },
            },
          ],
        });

        const schema = oas.operation('/', 'get').getParametersAsJsonSchema();
        expect(schema[0].schema.properties.userId).to.deep.equal({
          $schema: 'http://json-schema.org/draft-04/schema#',
          type: 'integer',
        });
      });

      it("should prioritize JSON-like content types if they're present", function () {
        const oas = createOas({
          parameters: [
            {
              name: 'userId',
              in: 'query',
              content: {
                // Though is the first entry here is XML, we should actually use the second instead
                // because it's JSON-like.
                'application/xml': { schema: { type: 'string' } },
                'application/vnd.github.v3.star+json': {
                  schema: { type: 'integer' },
                },
              },
            },
          ],
        });

        const schema = oas.operation('/', 'get').getParametersAsJsonSchema();
        expect(schema[0].schema.properties.userId).to.deep.equal({
          $schema: 'http://json-schema.org/draft-04/schema#',
          type: 'integer',
        });
      });

      it('should use the first content type if `application/json` is not present', function () {
        const oas = createOas({
          parameters: [
            {
              name: 'userId',
              in: 'query',
              content: {
                'application/xml': { schema: { type: 'integer' } },
                'text/plain': { schema: { type: 'string' } },
              },
            },
          ],
        });

        const schema = oas.operation('/', 'get').getParametersAsJsonSchema();
        expect(schema[0].schema.properties.userId).to.deep.equal({
          $schema: 'http://json-schema.org/draft-04/schema#',
          type: 'integer',
        });
      });
    });

    describe('common parameters', function () {
      it('should override path-level parameters on the operation level', function () {
        expect(
          (
            parametersCommon.operation('/anything/{id}/override', 'get').getParametersAsJsonSchema()[0].schema
              .properties.id as SchemaObject
          ).description
        ).to.equal('A comma-separated list of pet IDs');
      });

      it('should add common parameter to path params', function () {
        const operation = parametersCommon.operation('/anything/{id}', 'get');
        expect((operation.getParametersAsJsonSchema()[0].schema.properties.id as SchemaObject).description).to.equal(
          'ID parameter'
        );
      });
    });
  });

  describe('request bodies', function () {
    describe('should convert request bodies to JSON schema', function () {
      it('application/json', function () {
        const operation = petstore.operation('/pet', 'post');
        expect(operation.getParametersAsJsonSchema()).toMatchSnapshot();
      });

      it('application/x-www-form-urlencoded', function () {
        const operation = petstoreServerVars.operation('/pet/{petId}', 'post');
        expect(operation.getParametersAsJsonSchema()).toMatchSnapshot();
      });
    });

    it('should not return anything for an empty schema', function () {
      const oas = createOas({
        requestBody: {
          description: 'Body description',
          content: {
            'application/json': {
              schema: {},
            },
          },
        },
      });

      expect(oas.operation('/', 'get').getParametersAsJsonSchema()).to.have.lengthOf(0);
    });

    it('should not return anything for a requestBody that has no schema', function () {
      const oas = createOas({
        requestBody: {
          description: 'Body description',
          content: {
            'text/plain': {
              example: '',
            },
          },
        },
      });

      expect(oas.operation('/', 'get').getParametersAsJsonSchema()).to.have.lengthOf(0);
    });
  });

  describe('$ref quirks', function () {
    it("should retain $ref pointers in the schema even if they're circular", async function () {
      const circular = await import('../__datasets__/circular.json').then(r => r.default).then(Oas.init);
      await circular.dereference();

      expect(circular.operation('/', 'put').getParametersAsJsonSchema()[0].schema.properties.content)
        .to.have.property('items')
        .and.deep.equal({ $ref: '#/components/schemas/SalesLine' });
    });
  });

  describe('polymorphism / discriminators', function () {
    it('should retain discriminator `mapping` refs when present', function () {
      const operation = discriminators.operation('/anything/discriminator-with-mapping', 'patch');
      expect(operation.getParametersAsJsonSchema()).toMatchSnapshot();
    });
  });

  describe('type', function () {
    describe('request bodies', function () {
      describe('repair invalid schema that has no `type`', function () {
        it('should add a missing `type: object` on a schema that is clearly an object', function () {
          const oas = createOas(
            {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      properties: {
                        uri: {
                          type: 'string',
                          format: 'uri',
                        },
                        messages: {
                          type: 'array',
                          items: {
                            $ref: '#/components/schemas/messages',
                          },
                        },
                        user: {
                          $ref: '#/components/schemas/user',
                        },
                      },
                    },
                  },
                },
              },
            },
            {
              schemas: {
                messages: {
                  properties: {
                    message: {
                      type: 'string',
                    },
                  },
                },
                user: {
                  required: ['user_id'],
                  properties: {
                    user_id: {
                      type: 'integer',
                    },
                  },
                },
              },
            }
          );

          // So we can test that components are transformed, this test intentionally does **not**
          // dereference the API definition.
          const schema = oas.operation('/', 'get').getParametersAsJsonSchema();

          expect(schema[0].schema.components.schemas.messages.type).to.equal('object');
          expect(schema[0].schema.components.schemas.user.type).to.equal('object');
        });
      });
    });
  });

  describe('descriptions', function () {
    it.skip('should pass through description on requestBody');

    it('should pass through description on parameters', function () {
      const oas = createOas({
        parameters: [
          {
            in: 'header',
            name: 'Accept',
            description: 'Expected response format.',
            schema: {
              type: 'string',
            },
          },
        ],
      });

      expect(oas.operation('/', 'get').getParametersAsJsonSchema()).to.deep.equal([
        {
          label: 'Headers',
          type: 'header',
          schema: {
            type: 'object',
            properties: {
              Accept: {
                $schema: 'http://json-schema.org/draft-04/schema#',
                description: 'Expected response format.',
                type: 'string',
              },
            },
            required: [],
          },
        },
      ]);
    });

    it('should pass through description on parameter when referenced as a `$ref` and a `requestBody` is present', async function () {
      const oas = createOas(
        {
          parameters: [
            {
              $ref: '#/components/parameters/pathId',
            },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                },
              },
            },
          },
        },
        {
          parameters: {
            pathId: {
              name: 'pathId',
              in: 'path',
              description: 'Description for the pathId',
              required: true,
              schema: {
                type: 'integer',
                format: 'uint32',
              },
            },
          },
        }
      );

      await oas.dereference();

      expect(oas.operation('/', 'get').getParametersAsJsonSchema()[0].schema).to.deep.equal({
        type: 'object',
        properties: {
          pathId: {
            $schema: 'http://json-schema.org/draft-04/schema#',
            type: 'integer',
            format: 'uint32',
            maximum: 4294967295,
            minimum: 0,
            description: 'Description for the pathId',
          },
        },
        required: ['pathId'],
      });
    });
  });

  describe('required', function () {
    it.skip('should pass through `required` on parameters');

    it.skip('should make things required correctly for request bodies');
  });

  describe('`example` / `examples` support', function () {
    describe('parameters', function () {
      // eslint-disable-next-line mocha/no-setup-in-describe
      ['example', 'examples'].forEach(exampleProp => {
        it(`should pick up \`${exampleProp}\` if declared outside of the schema`, function () {
          function createExample(value, inSchema = false) {
            if (exampleProp === 'example') {
              return value;
            }

            if (inSchema) {
              return [value];
            }

            return {
              distinctName: {
                value,
              },
            };
          }

          const oas = createOas({
            parameters: [
              {
                in: 'query',
                name: 'query parameter',
                schema: {
                  type: 'string',
                },
                [exampleProp]: createExample('example foo'),
              },
              {
                in: 'query',
                name: 'query parameter alt',
                schema: {
                  type: 'string',
                  [exampleProp]: createExample('example bar', true),
                },
              },
            ],
          });

          const schema = oas.operation('/', 'get').getParametersAsJsonSchema();
          expect(schema).to.deep.equal([
            {
              type: 'query',
              label: 'Query Params',
              schema: {
                type: 'object',
                properties: {
                  'query parameter': {
                    $schema: 'http://json-schema.org/draft-04/schema#',
                    type: 'string',
                    examples: ['example foo'],
                  },
                  'query parameter alt': {
                    $schema: 'http://json-schema.org/draft-04/schema#',
                    type: 'string',
                    examples: ['example bar'],
                  },
                },
                required: [],
              },
            },
          ]);
        });
      });
    });
  });

  describe('deprecated', function () {
    describe('parameters', function () {
      it('should pass through deprecated on parameters', function () {
        const oas = createOas({
          parameters: [
            {
              in: 'header',
              name: 'Accept',
              deprecated: true,
              schema: {
                type: 'string',
              },
            },
          ],
        });

        expect(oas.operation('/', 'get').getParametersAsJsonSchema()).to.deep.equal([
          {
            label: 'Headers',
            type: 'header',
            schema: {
              type: 'object',
              properties: {},
              required: [],
            },
            deprecatedProps: {
              type: 'header',
              schema: {
                type: 'object',
                $schema: 'http://json-schema.org/draft-04/schema#',
                properties: {
                  Accept: {
                    $schema: 'http://json-schema.org/draft-04/schema#',
                    type: 'string',
                    deprecated: true,
                  },
                },
                required: [],
              },
            },
          },
        ]);
      });

      it('should pass through deprecated on parameter when referenced as a `$ref` and a `requestBody` is present', async function () {
        const oas = createOas(
          {
            parameters: [
              {
                $ref: '#/components/parameters/pathId',
              },
            ],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                  },
                },
              },
            },
          },
          {
            parameters: {
              pathId: {
                name: 'pathId',
                in: 'path',
                deprecated: true,
                schema: {
                  type: 'integer',
                  format: 'uint32',
                },
              },
            },
          }
        );

        await oas.dereference();
        expect(oas.operation('/', 'get').getParametersAsJsonSchema()[0].deprecatedProps.schema).to.deep.equal({
          type: 'object',
          $schema: 'http://json-schema.org/draft-04/schema#',
          properties: {
            pathId: {
              $schema: 'http://json-schema.org/draft-04/schema#',
              type: 'integer',
              format: 'uint32',
              maximum: 4294967295,
              minimum: 0,
              deprecated: true,
            },
          },
          required: [],
        });
      });

      it('should create deprecatedProps from body and metadata parameters', function () {
        const operation = deprecated.operation('/anything', 'post');
        expect(operation.getParametersAsJsonSchema()).toMatchSnapshot();
      });

      it('should not put required deprecated parameters in deprecatedProps', function () {
        const operation = deprecated.operation('/anything', 'post');
        const deprecatedSchema = operation.getParametersAsJsonSchema()[1].deprecatedProps.schema;

        (deprecatedSchema.required as string[]).forEach(requiredParam => {
          expect(requiredParam in deprecatedSchema.properties).to.be.false;
        });
        expect(Object.keys(deprecatedSchema.properties)).to.have.lengthOf(4);
      });

      it('should not put readOnly deprecated parameters in deprecatedProps', function () {
        const operation = deprecated.operation('/anything', 'post');
        const deprecatedSchema = operation.getParametersAsJsonSchema()[1].deprecatedProps.schema;

        expect(Object.keys(deprecatedSchema.properties)).to.have.lengthOf(4);
        expect('idReadOnly' in Object.keys(deprecatedSchema.properties)).to.be.false;
      });
    });

    describe('request bodies', function () {
      it('should pass through deprecated on a request body schema property', function () {
        const oas = createOas({
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  properties: {
                    uri: {
                      type: 'string',
                      format: 'uri',
                    },
                    messages: {
                      type: 'array',
                      items: {
                        type: 'string',
                      },
                      deprecated: true,
                    },
                  },
                },
              },
            },
          },
        });

        expect(oas.operation('/', 'get').getParametersAsJsonSchema()).to.deep.equal([
          {
            type: 'body',
            label: 'Body Params',
            schema: {
              $schema: 'http://json-schema.org/draft-04/schema#',
              properties: {
                uri: { type: 'string', format: 'uri' },
              },
              type: 'object',
            },
            deprecatedProps: {
              type: 'body',
              schema: {
                $schema: 'http://json-schema.org/draft-04/schema#',
                properties: {
                  messages: {
                    type: 'array',
                    items: {
                      type: 'string',
                    },
                    deprecated: true,
                  },
                },
                type: 'object',
              },
            },
          },
        ]);
      });
    });

    describe('polymorphism', function () {
      it('should pass through deprecated on a (merged) allOf schema', function () {
        const oas = createOas({
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    {
                      type: 'object',
                      properties: {
                        uri: {
                          type: 'string',
                          format: 'uri',
                        },
                      },
                    },
                    {
                      type: 'object',
                      properties: {
                        messages: {
                          type: 'array',
                          items: {
                            type: 'string',
                          },
                          deprecated: true,
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        });

        expect(oas.operation('/', 'get').getParametersAsJsonSchema()).toMatchSnapshot();
      });
    });
  });

  describe('options', function () {
    describe('globalDefaults', function () {
      it('should use user defined `globalDefaults` for requestBody', function () {
        const operation = petstore.operation('/pet', 'post');
        const jwtDefaults = {
          category: {
            id: 4,
            name: 'Testing',
          },
        };

        const jsonSchema = operation.getParametersAsJsonSchema({ globalDefaults: jwtDefaults });
        expect((jsonSchema[0].schema.properties.category as SchemaObject).default).to.deep.equal(jwtDefaults.category);
      });

      it('should use user defined `globalDefaults` for parameters', function () {
        const operation = petstore.operation('/pet/{petId}', 'get');
        const jwtDefaults = {
          petId: 1,
        };

        const jsonSchema = operation.getParametersAsJsonSchema({ globalDefaults: jwtDefaults });
        expect((jsonSchema[0].schema.properties.petId as SchemaObject).default).to.deep.equal(jwtDefaults.petId);
      });
    });

    describe('mergeIntoBodyAndMetadata', function () {
      it('should merge params categorized as metadata into a single block', function () {
        const operation = petstore.operation('/pet/{petId}', 'delete');
        const jsonSchema = operation.getParametersAsJsonSchema({
          mergeIntoBodyAndMetadata: true,
          retainDeprecatedProperties: true,
        });

        expect(jsonSchema).toMatchSnapshot();
      });

      it('should not create an empty `allOf` for metadata if there is no metadata', function () {
        const operation = petstore.operation('/user', 'post');
        const jsonSchema = operation.getParametersAsJsonSchema({
          mergeIntoBodyAndMetadata: true,
          retainDeprecatedProperties: true,
        });

        expect(jsonSchema.map(js => js.type)).to.deep.equal(['body']);
      });

      describe('retainDeprecatedProperties (default behavior)', function () {
        it('should support merging `deprecatedProps` together', function () {
          const oas = createOas({
            parameters: [
              {
                in: 'header',
                name: 'Accept',
                deprecated: true,
                schema: {
                  type: 'string',
                },
              },
            ],
          });

          const jsonSchema = oas.operation('/', 'get').getParametersAsJsonSchema({ mergeIntoBodyAndMetadata: true });
          expect(jsonSchema).toMatchSnapshot();
        });
      });
    });

    describe('retainDeprecatedProperties', function () {
      it('should retain deprecated properties within their original schemas', function () {
        const oas = createOas({
          parameters: [
            {
              in: 'header',
              name: 'Accept',
              deprecated: true,
              schema: {
                type: 'string',
              },
            },
          ],
        });

        const jsonSchema = oas.operation('/', 'get').getParametersAsJsonSchema({ retainDeprecatedProperties: true });

        expect(jsonSchema[0].schema).to.have.property('type').and.equal('object');
        expect(jsonSchema[0].schema).to.have.property('properties').and.have.property('Accept').and.be.a('object');
        expect(jsonSchema[0].schema).to.have.property('required').and.have.lengthOf(0);
        expect(jsonSchema[0].deprecatedProps).to.be.undefined;
      });
    });
  });
});
