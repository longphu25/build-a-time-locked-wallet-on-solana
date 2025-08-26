# TODO

[] Implement error handling for failed token transfers
[x] Add unit tests for all program functions
[] Optimize CPI calls for gas efficiency
[x] Add a countdown timer to unlock in the UI
[x] Improve UI/UX for better user experience - Updated UI to support multiple time locks
[x] add has_one = user @TimeLockError::Unauthorized
[x] allowing users to create multiple time locks with different amounts (amount to the PDA seeds to allow multiple time locks)
[x] when user withdraw , it will close PDA and rent lamports back to user
[x] remove is_withdrawn flag from time lock account
[x] Update UI for multiple time locks with different amounts and PDA closing functionality
[] separate test cases for both SPL and SOL functionality
[] Setting up AI Tooling for Solana development

```bash
curl -L https://solana.com/llms.txt --create-dirs -o .github/solana.instructions.md
```
