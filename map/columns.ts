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
