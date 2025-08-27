/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/time_locked_wallet.json`.
 */
export type TimeLockedWallet = {
  "address": "AMEdHNwAUw2eBkm26Pwn2aePe6bQ7Vgzjeavx3uNvkGn",
  "metadata": {
    "name": "timeLockedWallet",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Time-locked wallet on Solana"
  },
  "instructions": [
    {
      "name": "initializeLock",
      "discriminator": [
        182,
        214,
        195,
        105,
        58,
        73,
        81,
        124
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "timeLock",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  109,
                  101,
                  95,
                  108,
                  111,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "arg",
                "path": "amount"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "unlockTimestamp",
          "type": "i64"
        }
      ]
    },
    {
      "name": "withdraw",
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true,
          "relations": [
            "timeLock"
          ]
        },
        {
          "name": "timeLock",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  109,
                  101,
                  95,
                  108,
                  111,
                  99,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "arg",
                "path": "amount"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "timeLock",
      "discriminator": [
        254,
        6,
        114,
        1,
        127,
        220,
        253,
        110
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unlockTimeInPast",
      "msg": "Unlock timestamp must be in the future"
    },
    {
      "code": 6001,
      "name": "stillLocked",
      "msg": "Funds are still locked"
    },
    {
      "code": 6002,
      "name": "unauthorized",
      "msg": "You are not authorized to withdraw from this time lock"
    }
  ],
  "types": [
    {
      "name": "timeLock",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "unlockTimestamp",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
