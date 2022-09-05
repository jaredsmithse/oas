import { expect } from 'chai';

import getUserVariable from '../../src/lib/get-user-variable';

const topLevelUser = { apiKey: '123456', user: 'user', pass: 'pass' };
const keysUser = {
  keys: [
    { apiKey: '123456', name: 'app-1' },
    { apiKey: '7890', name: 'app-2' },
  ],
};

describe('getUserVariable', function () {
  it('should handle if keys is an empty array', function () {
    expect(getUserVariable({ keys: [] }, 'apiKey')).to.be.null;
  });

  it('should handle if keys is null', function () {
    expect(getUserVariable({ keys: null }, 'apiKey')).to.be.null;
  });

  it('should return top level property', function () {
    expect(getUserVariable(topLevelUser, 'apiKey')).to.equal('123456');
  });

  it('should return first item from keys array if no app selected', function () {
    expect(getUserVariable(keysUser, 'apiKey')).to.equal('123456');
  });

  it('should return selected app from keys array if app provided', function () {
    expect(getUserVariable(keysUser, 'apiKey', 'app-2')).to.equal('7890');
  });
});
