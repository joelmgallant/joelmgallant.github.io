// DynamoDB storage: one item per date holding each person's answer, plus one game#<date> item per Bonus Round.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

export function createStore(tableName) {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
  return {
    async get(date) {
      const { Item } = await client.send(new GetCommand({ TableName: tableName, Key: { date } }));
      return Item ?? null;
    },
    async putAnswer(date, person, answer) {
      const { Attributes } = await client.send(new UpdateCommand({
        TableName: tableName, Key: { date },
        UpdateExpression: 'SET #person = :answer',
        ExpressionAttributeNames: { '#person': person },
        ExpressionAttributeValues: { ':answer': answer },
        ReturnValues: 'ALL_NEW',
      }));
      return Attributes;
    },
    /** Set one attribute; with ifAbsent, returns null instead of overwriting an existing value. */
    async setField(key, field, value, { ifAbsent = false } = {}) {
      try {
        const { Attributes } = await client.send(new UpdateCommand({
          TableName: tableName, Key: { date: key },
          UpdateExpression: 'SET #field = :value',
          ...(ifAbsent ? { ConditionExpression: 'attribute_not_exists(#field)' } : {}),
          ExpressionAttributeNames: { '#field': field },
          ExpressionAttributeValues: { ':value': value },
          ReturnValues: 'ALL_NEW',
        }));
        return Attributes;
      } catch (error) {
        if (ifAbsent && error.name === 'ConditionalCheckFailedException') return null;
        throw error;
      }
    },
    async scan() {
      const items = [];
      let ExclusiveStartKey;
      do {
        const page = await client.send(new ScanCommand({ TableName: tableName, ExclusiveStartKey }));
        items.push(...(page.Items ?? []));
        ExclusiveStartKey = page.LastEvaluatedKey;
      } while (ExclusiveStartKey);
      return items;
    },
  };
}
