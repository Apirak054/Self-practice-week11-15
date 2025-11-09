//sync
console.log("starting...")
console.log("working...")
console.log("ending...")

//async
console.log("starting...")
setTimeout(() => console.log("working...5"), 5000) //async function
console.log("ending...")


console.log("=====================================")

async function doSomething(hasProblem) {
  return new Promise((resolve, reject) => {
    setTimeout(
      () => (hasProblem ? reject("Fail Working") : resolve("Fully Complete")),
      5000
    )
  })
}
console.log("starting...")
const workingStatus = doSomething(false)
console.log(workingStatus)
console.log("ending...")

console.log("=====================================")

//1) using .then().catch()
console.log("starting...")
doSomething(true).then((workingStatus) => {
  console.log(workingStatus)
  console.log("ending...")
})
  .catch((errorMessage) => {
    console.log(errorMessage)
  })

console.log("=====================================")

//2) async-await
console.log("starting... ")
async function runworking() {
  try{
     const workingStatus = await doSomething(true)
  console.log(workingStatus)
  console.log("ending...")
  }
  catch(error){
  console.log(error)
  }
  runworking()
}



