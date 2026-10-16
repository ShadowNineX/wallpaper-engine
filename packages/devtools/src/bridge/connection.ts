import Type from 'typebox';
import Schema from 'typebox/schema';
import { BRIDGE_SOURCE, BRIDGE_VERSION } from './protocol';

export const ReadyValidator = Schema.Compile(Type.Object({
  source: Type.Literal(BRIDGE_SOURCE),
  version: Type.Literal(BRIDGE_VERSION),
  kind: Type.Literal('ready'),
  token: Type.String({ minLength: 1, maxLength: 128 }),
}, { additionalProperties: false }));

export const ConnectedValidator = Schema.Compile(Type.Object({
  source: Type.Literal(BRIDGE_SOURCE),
  version: Type.Literal(BRIDGE_VERSION),
  kind: Type.Literal('connected'),
}, { additionalProperties: false }));
