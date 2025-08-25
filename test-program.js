import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

async function testProgram() {
  try {
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    const programId = new PublicKey('G9C4ivjLy46CfRH8wbxBLDX4eSunQaZopoiSK2E9LymC');
    
    console.log('Testing program deployment...');
    console.log('Program ID:', programId.toString());
    console.log('Network: devnet');
    
    const programInfo = await connection.getAccountInfo(programId);
    
    if (programInfo) {
      console.log('✅ Program found on devnet');
      console.log('Program owner:', programInfo.owner.toString());
      console.log('Program data length:', programInfo.data.length);
      console.log('Program executable:', programInfo.executable);
    } else {
      console.log('❌ Program not found on devnet');
    }
  } catch (error) {
    console.error('Error testing program:', error);
  }
}

testProgram();
