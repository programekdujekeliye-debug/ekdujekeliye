async function pollLiveDeployment() {
  const workerSecret = '023176b693554f4439e2f67716e0760a8ff953c2aee2165dbd485237ab6297fe';
  const liveUrl = 'https://ekdujekeliye-s9fx.onrender.com';
  
  console.log('Polling Render live deployment at:', liveUrl);
  
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      const res = await fetch(liveUrl + '/api/internal/archive/health', {
        headers: { 'Authorization': 'Bearer ' + workerSecret }
      });
      
      if (res.status === 200) {
        const data = await res.json();
        console.log(`Attempt ${attempt}: HTTP 200 - Response:`, JSON.stringify(data));
        if (data.capabilities && data.capabilities.claimOne) {
          console.log('\n🎉 SUCCESS! Render backend is live with claimOne capability.');
          return true;
        }
      } else {
        console.log(`Attempt ${attempt}: HTTP ${res.status}`);
      }
    } catch (err) {
      console.log(`Attempt ${attempt}: Connection error: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 6000));
  }
  return false;
}

pollLiveDeployment();
