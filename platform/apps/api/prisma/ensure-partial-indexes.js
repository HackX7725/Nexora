const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const indexes = [
  { collection: 'users', name: 'users_email_key', key: { email: 1 } },
  { collection: 'users', name: 'users_phone_key', key: { phone: 1 } },
  { collection: 'sessions', name: 'sessions_previous_token_hash_key', key: { previous_token_hash: 1 } },
  { collection: 'conversations', name: 'conversations_direct_key_key', key: { direct_key: 1 } },
];

async function dropIndex(index) {
  await prisma.$runCommandRaw({ dropIndexes: index.collection, index: index.name }).catch(() => undefined);
}

async function replaceIndex(index) {
  await dropIndex(index);
  const field = Object.keys(index.key)[0];
  await prisma.$runCommandRaw({
    createIndexes: index.collection,
    indexes: [
      {
        key: index.key,
        name: index.name,
        unique: true,
        partialFilterExpression: { [field]: { $type: 'string' } },
      },
    ],
  });
}

async function ensureContactIndexes() {
  const specs = [
    { key: { owner_id: 1 }, name: 'contacts_owner_id_idx' },
    { key: { owner_id: 1, contact_user_id: 1 }, name: 'contacts_owner_id_contact_user_id_key', unique: true },
  ];
  for (const spec of specs) {
    await prisma.$runCommandRaw({
      createIndexes: 'contacts',
      indexes: [spec],
    }).catch(() => undefined);
  }
}

Promise.all(indexes.map(replaceIndex))
  .then(() => ensureContactIndexes())
  .then(() => {
    console.log(`partial-unique=${indexes.length}`);
  })
  .finally(() => prisma.$disconnect());
