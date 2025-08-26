build-idl:
	ANCHOR_LOG=false && anchor idl build

build-idl-log:
	ANCHOR_LOG=true anchor idl build

test-nobuild:
	anchor test --skip-build

keys-list-sync:
	anchor keys list
	anchor keys sync
	anchor keys sync --program-name time-locked-wallet