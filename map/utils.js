/*
 * @Author: junlin.wu
 * @Date: 2025-03-12 16:49:09
 * @LastEditors: junlin.wu
 * @Description: content
 */
// 紧急报警记录数据
export const emergencyColumns = [
  {
    title: '序号',
    dataIndex: 'index',
    align: 'center',
    ellipsis: true,
    width: '15%',
  },
  {
    title: '时间',
    dataIndex: 'startDateTime',
    align: 'center',
    ellipsis: true,
    width: '30%',
  },
  {
    title: '设备',
    dataIndex: 'oneClickAlarmName',
    align: 'center',
    ellipsis: true,
    width: '30%',
  },
  {
    title: '操作',
    dataIndex: 'operation',
    align: 'center',
    ellipsis: true,
    width: '25%',
  },
]

export const columns = [
  {
    title: '设备统计',
    dataIndex: 'name',
    align: 'center',
    ellipsis: true,
    width: '25%',
  },
  {
    title: '总数',
    dataIndex: 'total',
    align: 'center',
    ellipsis: true,
    width: '20%',
  },
  {
    title: '在线数',
    dataIndex: 'onlineNum',
    align: 'center',
    ellipsis: true,
    width: '20%',
  },
  {
    title: '在线率',
    dataIndex: 'onlineRate',
    align: 'center',
    ellipsis: true,
    width: '20%',
  },
  {
    title: '故障率',
    dataIndex: 'faultRate',
    align: 'center',
    ellipsis: true,
    width: '15%',
  },
]
/** 高德坐标转百度坐标
 * @param {number} lng 高德经度
 * @param {number} lat 高德纬度
 * @returns {[number, number]} 返回[经度, 纬度]
 */
export const convertGdToBd = (lng, lat) => {
  const X_PI = Math.PI * 3000.0 / 180.0
  const x = lng
  const y = lat
  const z = Math.sqrt(x * x + y * y) + 0.00002 * Math.sin(y * X_PI)
  const theta = Math.atan2(y, x) + 0.000003 * Math.cos(x * X_PI)
  const bdLng = z * Math.cos(theta) + 0.0065
  const bdLat = z * Math.sin(theta) + 0.006
  return [bdLng, bdLat]
}
