import { expect } from 'chai';

import utils from '../src/utils';

describe('utils', function () {
  it('should expose `jsonSchemaTypes`', function () {
    expect(utils.jsonSchemaTypes).to.deep.equal({
      path: 'Path Params',
      query: 'Query Params',
      body: 'Body Params',
      cookie: 'Cookie Params',
      formData: 'Form Data',
      header: 'Headers',
      metadata: 'Metadata',
    });
  });
});
