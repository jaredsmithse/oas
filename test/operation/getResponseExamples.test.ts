import type * as RMOAS from '../../src/rmoas.types';

import { expect } from 'chai';

import Oas from '../../src';
import cleanStringify from '../__fixtures__/json-stringify-clean';

let operationExamples: Oas;
let petstore: Oas;
let readonlyWriteonly: Oas;

describe('#getResponseExamples', function () {
  before(async function () {
    operationExamples = await import('../__datasets__/operation-examples.json').then(r => r.default).then(Oas.init);
    await operationExamples.dereference();

    petstore = await import('@readme/oas-examples/3.0/json/petstore.json').then(r => r.default).then(Oas.init);
    await petstore.dereference();

    readonlyWriteonly = await import('../__datasets__/readonly-writeonly.json').then(r => r.default).then(Oas.init);
    await readonlyWriteonly.dereference();
  });

  it('should handle if there are no responses', function () {
    const operation = operationExamples.operation('/nothing', 'get');
    expect(operation.getResponseExamples()).to.have.lengthOf(0);
  });

  it('should handle if there are no response schemas', function () {
    const operation = operationExamples.operation('/no-response-schemas', 'get');
    expect(operation.getResponseExamples()).to.have.lengthOf(0);
  });

  it('should support */* media types', function () {
    const operation = operationExamples.operation('/wildcard-media-type', 'post');
    expect(operation.getResponseExamples()).to.deep.equal([
      {
        status: '200',
        mediaTypes: {
          '*/*': [
            {
              value: {
                id: 12343354,
                email: 'test@example.com',
                name: 'Test user name',
              },
            },
          ],
        },
      },
    ]);
  });

  it('should do its best at handling circular schemas', async function () {
    const circular = await import('../__datasets__/circular.json').then(r => r.default).then(Oas.init);
    await circular.dereference();

    const operation = circular.operation('/', 'get');
    const examples = await operation.getResponseExamples();

    expect(examples).to.have.lengthOf(1);

    // Though `offsetAfter` and `offsetBefore` are part of this schema, they're missing from the
    // example because they're a circular ref.
    //
    // We should replace our dereference work in Oas with `swagger-client` and its `.resolve()`
    // method as it can better handle circular references. For example, with the above schema
    // dereferenced through it, we'll generate the following example:
    //
    //  {
    //    dateTime: '2020-11-03T00:09:44.920Z',
    //    offsetAfter: { id: 'string', rules: { transitions: [ undefined ] } },
    //    offsetBefore: { id: 'string', rules: { transitions: [ undefined ] } }
    //  }
    let example = (examples[0] as Record<string, RMOAS.MediaTypeObject>).mediaTypes['application/json'];
    example = example[0].value;
    expect(example).to.have.property('dateTime').and.be.a('string');
    expect(example).to.have.property('offsetAfter').and.be.undefined;
    expect(example).to.have.property('offsetBefore').and.be.undefined;
  });

  it('should return an empty example if headers exist on a response with no content', function () {
    const operation = operationExamples.operation('/headers-but-no-content', 'post');
    expect(operation.getResponseExamples()).to.deep.equal([
      {
        status: '200',
        mediaTypes: {
          '*/*': [],
        },
        onlyHeaders: true,
      },
    ]);
  });

  describe('no curated examples present', function () {
    it('should not generate an example schema if there is no documented schema and an empty example', function () {
      const operation = operationExamples.operation('/emptyexample', 'post');
      expect(operation.getResponseExamples()).to.deep.equal([
        {
          status: '200',
          mediaTypes: {
            'application/json': [],
          },
        },
      ]);
    });

    it('should generate examples if an `examples` property is present but empty', function () {
      const operation = operationExamples.operation('/emptyexample-with-schema', 'post');
      expect(operation.getResponseExamples()).to.deep.equal([
        {
          status: '200',
          mediaTypes: {
            'application/json': [
              {
                value: [
                  {
                    id: 0,
                    name: 'string',
                  },
                ],
              },
            ],
          },
        },
      ]);
    });

    it('should generate examples if none are readily available', function () {
      const petExample = [
        {
          id: 25,
          category: {
            id: 0,
            name: 'string',
          },
          name: 'doggie',
          photoUrls: ['https://example.com/photo.png'],
          tags: [
            {
              id: 0,
              name: 'string',
            },
          ],
          status: 'available',
        },
      ];

      const operation = petstore.operation('/pet/findByStatus', 'get');
      expect(operation.getResponseExamples()).to.deep.equal([
        {
          status: '200',
          mediaTypes: {
            // Though this operation responds with `application/json` and `application/xml`, since
            // there aren't any examples present we can only generate an example for the JSON
            // response as what we generate is JSON, not XML.
            'application/json': [
              {
                value: petExample,
              },
            ],
            'application/xml': [],
          },
        },
      ]);
    });
  });

  describe('defined within response `content`', function () {
    const userExample = {
      id: 12343354,
      email: 'test@example.com',
      name: 'Test user name',
    };

    describe('`example`', function () {
      it('should return examples', function () {
        const operation = operationExamples.operation('/single-media-type-single-example-in-example-prop', 'post');
        expect(operation.getResponseExamples()).to.deep.equal([
          {
            status: '200',
            mediaTypes: {
              'application/json': [
                {
                  value: userExample,
                },
              ],
            },
          },
        ]);
      });

      it('should transform a $ref in a singular example', function () {
        const operation = operationExamples.operation(
          '/single-media-type-single-example-in-example-prop-with-ref',
          'post'
        );
        expect(operation.getResponseExamples()).to.deep.equal([
          {
            status: '200',
            mediaTypes: {
              'application/json': [
                {
                  value: {
                    value: userExample,
                  },
                },
              ],
            },
          },
        ]);
      });

      it('should not fail if the example is a string', function () {
        const operation = operationExamples.operation(
          '/single-media-type-single-example-in-example-prop-thats-a-string',
          'post'
        );
        expect(operation.getResponseExamples()).to.deep.equal([
          {
            status: '200',
            mediaTypes: {
              'application/json': [
                {
                  value: 'column1,column2,column3,column4',
                },
              ],
            },
          },
        ]);
      });
    });

    describe('`examples`', function () {
      // eslint-disable-next-line mocha/no-setup-in-describe
      [
        ['should return examples', '/examples-at-mediaType-level', 'post'],
        [
          'should return examples if there are examples for the operation, and one of the examples is a $ref',
          '/ref-examples',
          'post',
        ],
      ].forEach(([_, path, method]) => {
        it(_, function () {
          const operation = operationExamples.operation(path, method as RMOAS.HttpMethods);
          expect(operation.getResponseExamples()).to.deep.equal([
            {
              status: '200',
              mediaTypes: {
                'application/json': [
                  {
                    summary: 'response',
                    title: 'response',
                    value: {
                      user: {
                        email: 'test@example.com',
                        name: 'Test user name',
                      },
                    },
                  },
                ],
              },
            },
            {
              status: '400',
              mediaTypes: {
                'application/xml': [
                  {
                    summary: 'response',
                    title: 'response',
                    value:
                      '<?xml version="1.0" encoding="UTF-8"?><note><to>Tove</to><from>Jani</from><heading>Reminder</heading><body>Don\'t forget me this weekend!</body></note>',
                  },
                ],
              },
            },
            {
              status: 'default',
              mediaTypes: {
                'application/json': [
                  {
                    summary: 'response',
                    title: 'response',
                    value: {
                      user: {
                        id: 12343354,
                        email: 'test@example.com',
                        name: 'Test user name',
                      },
                    },
                  },
                ],
              },
            },
          ]);
        });
      });

      it('should not fail if the example is a string', function () {
        const operation = operationExamples.operation(
          '/single-media-type-single-example-in-examples-prop-that-are-strings',
          'post'
        );

        expect(operation.getResponseExamples()).to.deep.equal([
          {
            status: '200',
            mediaTypes: {
              'application/json': [
                {
                  summary: 'An example of a cat',
                  title: 'cat',
                  value: cleanStringify({
                    name: 'Fluffy',
                    petType: 'Cat',
                  }),
                },
              ],
            },
          },
          {
            status: '400',
            mediaTypes: {
              'application/xml': [
                {
                  summary: 'response',
                  title: 'response',
                  value:
                    '<?xml version="1.0" encoding="UTF-8"?><note><to>Tove</to><from>Jani</from><heading>Reminder</heading><body>Don\'t forget me this weekend!</body></note>',
                },
              ],
            },
          },
        ]);
      });

      it('should not fail if the example is null', function () {
        const spec = new Oas({
          openapi: '3.0.3',
          info: { title: 'testing', version: '1.0.0' },
          paths: {
            '/': {
              get: {
                responses: {
                  500: {
                    description: 'not ok',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'string',
                        },
                      },
                      'application/x-json': { examples: { response: { value: null } } },
                    },
                  },
                },
              },
            },
          },
        });

        expect(spec.operation('/', 'get').getResponseExamples()).to.deep.equal([
          {
            status: '500',
            mediaTypes: {
              'application/json': [
                {
                  value: 'string',
                },
              ],
              'application/x-json': [
                {
                  summary: 'response',
                  title: 'response',
                  value: null,
                },
              ],
            },
          },
        ]);
      });

      it('should not fail if the example is an array', function () {
        const operation = operationExamples.operation(
          '/single-media-type-single-example-in-examples-prop-that-are-arrays',
          'post'
        );

        expect(operation.getResponseExamples()).to.deep.equal([
          {
            status: '200',
            mediaTypes: {
              'application/json': [
                {
                  summary: 'An example of a cat',
                  title: 'cat',
                  value: cleanStringify([
                    {
                      name: 'Fluffy',
                      petType: 'Cat',
                    },
                  ]),
                },
              ],
            },
          },
          {
            status: '400',
            mediaTypes: {
              'application/xml': [
                {
                  summary: 'response',
                  title: 'response',
                  value:
                    '<?xml version="1.0" encoding="UTF-8"?><note><to>Tove</to><from>Jani</from><heading>Reminder</heading><body>Don\'t forget me this weekend!</body></note>',
                },
              ],
            },
          },
        ]);
      });

      it('should return multiple nested examples if there are multiple media types types for the operation', function () {
        const operation = operationExamples.operation('/multi-media-types-multiple-examples', 'post');

        expect(operation.getResponseExamples()).to.deep.equal([
          {
            status: '200',
            mediaTypes: {
              'text/plain': [
                {
                  summary: 'response',
                  title: 'response',
                  value: 'OK',
                },
              ],
              'application/json': [
                {
                  summary: 'An example of a cat',
                  title: 'cat',
                  value: {
                    name: 'Fluffy',
                    petType: 'Cat',
                  },
                },
                {
                  summary: "An example of a dog with a cat's name",
                  title: 'dog',
                  value: {
                    name: 'Puma',
                    petType: 'Dog',
                  },
                },
              ],
            },
          },
          {
            status: '400',
            mediaTypes: {
              'application/xml': [
                {
                  summary: 'response',
                  title: 'response',
                  value:
                    '<?xml version="1.0" encoding="UTF-8"?><note><to>Tove</to><from>Jani</from><heading>Reminder</heading><body>Don\'t forget me this weekend!</body></note>',
                },
              ],
            },
          },
        ]);
      });
    });
  });

  describe('readOnly / writeOnly handling', function () {
    it('should include `readOnly` schemas and exclude `writeOnly`', function () {
      const operation = readonlyWriteonly.operation('/', 'put');

      expect(operation.getResponseExamples()).to.deep.equal([
        {
          status: '200',
          mediaTypes: {
            'application/json': [
              {
                value: {
                  id: 'string',
                  propWithReadOnly: 'string',
                },
              },
            ],
          },
        },
      ]);
    });

    it('should retain `readOnly` and `writeOnly` settings when merging an allOf', function () {
      const operation = readonlyWriteonly.operation('/allOf', 'post');
      const today = new Date().toISOString().substring(0, 10);

      expect(operation.getResponseExamples()).to.deep.equal([
        {
          status: '200',
          mediaTypes: {
            'application/json': [
              {
                value: {
                  end_date: today,
                  end_hour: 'string',
                  id: 'string',
                  product_id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
                  readOnly_primitive: 'string',
                  start_date: today,
                  start_hour: 'string',
                },
              },
            ],
          },
        },
      ]);
    });
  });

  describe('deprecated handling', function () {
    let deprecated: Oas;

    before(async function () {
      deprecated = await import('../__datasets__/deprecated.json').then(r => r.default).then(Oas.init);
      await deprecated.dereference();
    });

    it('should include deprecated properties in examples', function () {
      const operation = deprecated.operation('/', 'post');
      expect(operation.getResponseExamples()).to.deep.equal([
        {
          mediaTypes: {
            'application/json': [{ value: [{ id: 0, name: 'string' }] }],
          },
          status: '200',
        },
      ]);
    });

    it('should pass through deprecated properties in examples on allOf schemas', function () {
      const operation = deprecated.operation('/allof-schema', 'post');
      expect(operation.getResponseExamples()).to.deep.equal([
        {
          mediaTypes: {
            'application/json': [{ value: [{ id: 0, name: 'string', category: 'string' }] }],
          },
          status: '200',
        },
      ]);
    });
  });

  it('sample generation should not corrupt the supplied operation', function () {
    const operation = readonlyWriteonly.operation('/', 'post');
    const today = new Date().toISOString().substring(0, 10);

    // Running this before `getResponseExamples` should have no effects on the output of the
    // `getResponseExamples` call.
    expect(operation.getRequestBodyExamples()).to.deep.equal([
      {
        mediaType: 'application/json',
        examples: [
          {
            value: {
              product_id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
              start_date: today,
              end_date: today,
            },
          },
        ],
      },
    ]);

    expect(operation.getResponseExamples()).to.deep.equal([
      {
        status: '201',
        mediaTypes: {
          'application/json': [
            {
              value: {
                id: 'string',
                product_id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
                start_date: today,
                end_date: today,
                start_hour: 'string',
                end_hour: 'string',
              },
            },
          ],
        },
      },
    ]);
  });
});
