import type { HttpMethods, ResponseObject, SchemaObject } from '../../src/rmoas.types';

import chai, { expect } from 'chai';
import { jestSnapshotPlugin } from 'mocha-chai-jest-snapshot';

import Oas from '../../src';
import createOas from '../__fixtures__/create-oas';
import chaiPlugins from '../helpers/chai-plugins';

chai.use(chaiPlugins);
chai.use(jestSnapshotPlugin());

let petstore: Oas;
let responses: Oas;

describe('getResponseAsJsonSchema', function () {
  before(async function () {
    petstore = await import('@readme/oas-examples/3.0/json/petstore.json').then(r => r.default).then(Oas.init);
    await petstore.dereference();

    responses = await import('../__datasets__/responses.json').then(r => r.default).then(Oas.init);
    await responses.dereference();
  });

  it('it should return with null if there is not a response', function () {
    expect(createOas({ responses: {} }).operation('/', 'get').getResponseAsJsonSchema('200')).to.be.null;
  });

  it('it should return with null if there is empty content', function () {
    const oas = createOas({
      responses: {
        200: {
          description: 'OK',
          content: {},
        },
      },
    });

    expect(oas.operation('/', 'get').getResponseAsJsonSchema('200')).to.be.null;
  });

  it('it should return a response as JSON Schema', function () {
    const operation = petstore.operation('/pet/{petId}/uploadImage', 'post');
    expect(operation.getResponseAsJsonSchema('200')).to.deep.equal([
      {
        label: 'Response body',
        description: 'successful operation',
        type: 'object',
        schema: {
          type: 'object',
          properties: {
            code: { type: 'integer', format: 'int32', maximum: 2147483647, minimum: -2147483648 },
            type: { type: 'string' },
            message: { type: 'string' },
          },
          'x-readme-ref-name': 'ApiResponse',
          $schema: 'http://json-schema.org/draft-04/schema#',
        },
      },
    ]);
  });

  describe('content type handling', function () {
    // eslint-disable-next-line mocha/no-setup-in-describe
    [
      [
        'should return a schema when one is present with a JSON-compatible vendor-prefixed content type',
        '/vendor-prefix-content-type',
        'get',
      ],
      [
        'should prefer the JSON-compatible content type when multiple content types are present',
        '/multiple-responses-with-a-json-compatible',
        'get',
      ],
      [
        'should prefer the JSON-compatible content type when JSON and wildcard types are both present',
        '/multiple-responses-with-json-compatible-and-wildcard',
        'get',
      ],
      ['should return a JSON Schema object for a wildcard content type', '/wildcard-content-type', 'get'],
    ].forEach(([_, path, method]) => {
      it(_, function () {
        const operation = responses.operation(path, method as HttpMethods);
        expect(operation.getResponseAsJsonSchema('200')).to.deep.equal([
          {
            label: 'Response body',
            description: 'OK',
            type: 'object',
            schema: {
              type: 'object',
              properties: {
                foo: { type: 'string' },
                bar: { type: 'number' },
              },
              'x-readme-ref-name': 'simple-object',
              $schema: 'http://json-schema.org/draft-04/schema#',
            },
          },
        ]);
      });
    });

    it("should return JSON Schema for a content type that isn't JSON-compatible", function () {
      expect(
        createOas({
          responses: {
            200: {
              description: 'response level description',
              content: {
                'image/png': {
                  schema: { type: 'string' },
                },
              },
            },
          },
        })
          .operation('/', 'get')
          .getResponseAsJsonSchema('200')
      ).to.deep.equal([
        {
          label: 'Response body',
          description: 'response level description',
          type: 'string',
          schema: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
          },
        },
      ]);
    });
  });

  describe('`enum` handling', function () {
    it('should supplement response schema descriptions with enums', async function () {
      const spec = await import('../__datasets__/response-enums.json').then(s => s.default).then(Oas.init);
      await spec.dereference();

      const operation = spec.operation('/anything', 'post');

      expect(operation.getResponseAsJsonSchema('200')).toMatchSnapshot();
    });
  });

  describe('`headers` support', function () {
    // https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#responseObject
    it('should include headers if they exist', function () {
      const oas = createOas({
        responses: {
          200: {
            description: 'response level description',
            headers: {
              foo: {
                description: 'this is a description for the foo header',
                schema: { type: 'string' },
              },
              bar: {
                schema: { type: 'number' },
              },
            },
          },
        },
      });

      expect(oas.operation('/', 'get').getResponseAsJsonSchema('200')).to.deep.equal([
        {
          label: 'Headers',
          description: 'response level description',
          type: 'object',
          schema: {
            type: 'object',
            properties: {
              foo: {
                description: 'this is a description for the foo header',
                type: 'string',
              },
              bar: {
                type: 'number',
              },
            },
          },
        },
      ]);
    });
  });

  describe('$schema version', function () {
    it('should add the v4 schema version to OpenAPI 3.0.x schemas', function () {
      const operation = petstore.operation('/pet/findByStatus', 'get');
      expect(operation.getResponseAsJsonSchema('200')[0].schema.$schema).to.equal(
        'http://json-schema.org/draft-04/schema#'
      );
    });

    it('should add v2020-12 schema version on OpenAPI 3.1 schemas', async function () {
      const petstore_31 = await import('@readme/oas-examples/3.1/json/petstore.json')
        .then(r => r.default)
        .then(Oas.init);
      await petstore_31.dereference();

      const operation = petstore_31.operation('/pet/findByStatus', 'get');
      expect(operation.getResponseAsJsonSchema('200')[0].schema.$schema).to.equal(
        'https://json-schema.org/draft/2020-12/schema#'
      );
    });
  });

  describe('quirks', function () {
    it('should not crash out when pulling a response that has no schema', function () {
      const operation = responses.operation('/response-with-example-and-no-schema', 'get');

      expect(operation.getResponseAsJsonSchema('200')).to.deep.equal([
        {
          type: 'string',
          schema: {
            $schema: 'http://json-schema.org/draft-04/schema#',
          },
          label: 'Response body',
        },
      ]);
    });

    describe('$ref quirks', function () {
      let circular: Oas;

      before(async function () {
        circular = await import('../__datasets__/circular.json').then(r => r.default).then(Oas.init);
      });

      it("should retain $ref pointers in the schema even if they're circular", function () {
        const operation = circular.operation('/', 'put');

        expect(operation.getResponseAsJsonSchema('200')[0].schema.items).to.deep.equal({
          $ref: '#/components/schemas/SalesLine',
        });
      });

      it('should default the root schema to a `string` if there is a circular `$ref` at the root', function () {
        const operation = circular.operation('/', 'put');
        expect(operation.getResponseAsJsonSchema('201')).to.deep.equal([
          {
            label: 'Response body',
            description: 'OK',
            type: 'string',
            schema: {
              $ref: '#/components/schemas/SalesLine',
              $schema: 'http://json-schema.org/draft-04/schema#',
              components: circular.api.components,
            },
          },
        ]);
      });

      it('should not override object references', async function () {
        const readme = await import('@readme/oas-examples/3.0/json/readme.json').then(r => r.default).then(Oas.init);
        await readme.dereference({ preserveRefAsJSONSchemaTitle: true });

        const operation = readme.operation('/api-specification', 'post');
        const schemas = operation.getResponseAsJsonSchema('401');

        expect(schemas[0].schema.oneOf[1].properties.docs).to.have.property('type').and.equal('string');
        expect(schemas[0].schema.oneOf[1].properties.docs).to.have.property('format').and.equal('url');
        expect(schemas[0].schema.oneOf[1].properties.docs)
          .to.have.property('description')
          .and.contain('log URL where you can see more information');
        expect(schemas[0].schema.oneOf[1].properties.docs)
          .to.have.property('examples')
          .and.deep.equal(['https://docs.readme.com/logs/6883d0ee-cf79-447a-826f-a48f7d5bdf5f']);

        const definition = readme.getDefinition();
        const authUnauthorizedResponse = definition.components.responses.authUnauthorized as ResponseObject;

        const doc = (
          ((authUnauthorizedResponse.content['application/json'].schema as SchemaObject).oneOf[0] as SchemaObject)
            .allOf[0] as SchemaObject
        ).properties.docs;

        expect(doc).have.property('type').and.equal('string');
        expect(doc).have.property('format').and.equal('url');
        expect(doc).have.property('description').and.contain('log URL where you can see more information');
        expect(doc).have.property('example').and.equal(
          // The original spec should have **not** been updated to the `examples` format that we
          // reshape this to in `getResponseAsJsonSchema`.
          'https://docs.readme.com/logs/6883d0ee-cf79-447a-826f-a48f7d5bdf5f'
        );

        // The original spec should still validate too!
        expect(definition).to.be.a.openapi('3.0.2');
      });
    });
  });
});
