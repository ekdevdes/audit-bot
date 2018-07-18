// 80-100 will be green/passing
// 70-79 will be yellow/needs attention
// 0-69 will be red/failing
module.exports = (passThreshold, averageThreshold, failThreshold) => {
    return {
        pass: (passThreshold || 80),
        average: (averageThreshold || 70),
        fail: (failThreshold || 69)
    }
}