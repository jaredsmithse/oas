import type { HttpMethods } from '../../src/rmoas.types';

import chai, { expect } from 'chai';
import { jestSnapshotPlugin } from 'mocha-chai-jest-snapshot';

import Oas from '../../src';

chai.use(jestSnapshotPlugin());

let operationExamples: Oas;
let callbacks: Oas;

describe('#getCallbackExamples', function () {
  before(async function () {
    operationExamples = await import('../__datasets__/operation-examples.json').then(r => r.default).then(Oas.init);
    await operationExamples.dereference();

    callbacks = await import('../__datasets__/callbacks.json').then(r => r.default).then(Oas.init);
    await callbacks.dereference();
  });

  it('should handle if there are no callbacks', function () {
    const operation = operationExamples.operation('/nothing', 'get');
    expect(operation.getCallbackExamples()).to.have.lengthOf(0);
  });

  it('should handle if there are no callback schemas', function () {
    const operation = operationExamples.operation('/no-response-schemas', 'get');
    expect(operation.getCallbackExamples()).to.have.lengthOf(0);
  });

  describe('no curated examples present', function () {
    it('should not generate an example schema if there is no documented schema and an empty example', function () {
      const operation = operationExamples.operation('/emptyexample', 'post');
      expect(operation.getCallbackExamples()).to.deep.equal([
        {
          identifier: 'myCallback',
          expression: '{$request.query.queryUrl}',
          method: 'post',
          example: [
            {
              status: '200',
              mediaTypes: {
                'application/json': [],
              },
            },
          ],
        },
      ]);
    });

    it('should generate examples if an `examples` property is present but empty', function () {
      const operation = operationExamples.operation('/emptyexample-with-schema', 'post');
      expect(operation.getCallbackExamples()).to.deep.equal([
        {
          identifier: 'myCallback',
          expression: '{$request.query.queryUrl}',
          method: 'post',
          example: [
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
          ],
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
        const operation = operationExamples.operation(path, method as HttpMethods);
        expect(operation.getCallbackExamples()).to.deep.equal([
          {
            identifier: 'myCallback',
            expression: '{$request.query.queryUrl}',
            method: 'post',
            example: [
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
            ],
          },
        ]);
      });
    });

    it('should return multiple nested examples if there are multiple media types types for the operation', function () {
      const operation = operationExamples.operation('/multi-media-types-multiple-examples', 'post');
      expect(operation.getCallbackExamples()).to.deep.equal([
        {
          identifier: 'myCallback',
          expression: '{$request.query.queryUrl}',
          method: 'post',
          example: [
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
          ],
        },
      ]);
    });
  });

  it('should return examples for multiple expressions and methods within a callback', function () {
    const operation = callbacks.operation('/callbacks', 'get');
    expect(operation.getCallbackExamples()).toMatchSnapshot();
  });
});
