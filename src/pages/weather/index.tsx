import React, { ComponentType } from 'react'
import Taro, { Component, Config } from '@tarojs/taro'
import { View, CoverView, Text, ScrollView, Image } from '@tarojs/components'
import WeatherIcon from '../../components/weather-icon'
import { observer, inject } from '@tarojs/mobx'
import { observable } from 'mobx'
import { QQ_MAP_KEY, GEOCODER_URL, HEFENG_BASE_URL, HEFENG_KEY } from '../../const'
import { dateFormat, array2Object, getBackgroundByCode, getDayOfWeek } from '../../utils'

import './index.less'

let last_update_time: number | null = null

interface Weather {
  props: {
    addressStore: {
      address: string
      setAddress: Function
      location: { latitude: number; longitude: number }
      setLocation: Function
    }
    weatherStore: {
      now: any
      today: any
      tomorrow: any
      hourly: any
      daily_forecast: any
      air: any
      lifestyle: any
      setNow: Function
      setDailyForecast: Function
      setHourly: Function
      setAir: Function
      setLifestyle: Function
    }
  }
}

@inject('addressStore', 'weatherStore')
@observer
class Weather extends Component {
  /**
   * 指定config的类型声明为: Taro.Config
   *
   * 由于 typescript 对于 object 类型推导只能推出 Key 的基本类型
   * 对于像 navigationBarTextStyle: 'black' 这样的推导出的类型是 string
   * 提示和声明 navigationBarTextStyle: 'black' | 'white' 类型冲突, 需要显示声明类型
   */
  config: Config = {
    navigationBarTitleText: 'Weather',
    enablePullDownRefresh: true,
    usingComponents: {
      'ff-canvas': '../../lib/f2-canvas/f2-canvas'
    }
  }
  @observable paddingTop: number = 0
  chartDetail: any = {}

  componentWillMount() {}

  componentWillReact() {}

  componentDidMount() {
    Taro.getSystemInfo().then(res => {
      this.paddingTop = res.statusBarHeight + 12
    })
    this.getAddress().then(() => {
      this.fetchData()
    })
  }

  componentWillUnmount() {}

  componentDidShow() {}

  componentDidHide() {}
  // 数据请求入口
  fetchData = () => {
    const { getWeatherNow, getAir, getWeatherHourly, getWeatherForecast, getLifestyle } = this

    const curTime = new Date().getTime()
    // 限制10s请求一次
    if (last_update_time && curTime - last_update_time < 10000) {
      Taro.showToast({
        title: '已经更新过了嗷~',
        icon: 'none',
        duration: 3000
      })
      return
    }

    last_update_time = curTime

    Taro.showLoading({
      title: '拼命请求中',
      mask: true
    })

    return Promise.all([
      getWeatherNow(),
      getAir(),
      getWeatherHourly(),
      getWeatherForecast(),
      getLifestyle()
    ])
      .then(() => {
        this.initChart()
        Taro.hideLoading()
      })
      .catch(() => {
        Taro.hideLoading()
      })
  }
  /**
   * 获取地址
   */
  getAddress = () => {
    return new Promise((resolve, reject) => {
      Taro.getLocation({ type: 'gcj02' })
        // 拿到当前坐标
        .then(
          res => {
            return Taro.request({
              url: GEOCODER_URL,
              data: {
                location: res.latitude + ',' + res.longitude,
                key: QQ_MAP_KEY
              }
            })
          },
          () => {
            Taro.showToast({
              title: '检测到您未授权使用位置权限，请先开启哦',
              icon: 'none',
              duration: 3000
            })
            reject()
          }
        )
        // 根据坐标拿到地址
        .then(({ data }: any) => {
          if (data.status !== 0) {
            Taro.showToast({
              title: data.message,
              icon: 'none',
              duration: 3000
            })
            return reject()
          }

          const { addressStore } = this.props
          // addressStore.setAddress(data.result.address_component.district)
          addressStore.setAddress(data.result.address)
          addressStore.setLocation({
            latitude: data.result.location.lat,
            longitude: data.result.location.lng
          })
          resolve()
        })
    })
  }
  /**
   * 实况天气
   */
  getWeatherNow = () => {
    const {
      addressStore: { location }
    } = this.props
    return Taro.request({
      url: HEFENG_BASE_URL + 'weather/now',
      data: {
        location: location.latitude + ',' + location.longitude,
        key: HEFENG_KEY
      }
    }).then(res => {
      const now = res.data.HeWeather6[0].now
      this.props.weatherStore.setNow(now)
    })
  }
  /**
   * 当前天气质量
   */
  getAir = () => {
    return Taro.request({
      url: HEFENG_BASE_URL + 'air/now',
      data: {
        location: 'auto_ip',
        key: HEFENG_KEY
      }
    }).then(res => {
      const air = res.data.HeWeather6[0].air_now_city
      this.props.weatherStore.setAir(air)
    })
  }
  /**
   * 时段天气
   */
  getWeatherHourly = () => {
    const {
      addressStore: { location }
    } = this.props
    return Taro.request({
      url: HEFENG_BASE_URL + 'weather/hourly',
      data: {
        location: location.latitude + ',' + location.longitude,
        key: HEFENG_KEY
      }
    }).then(res => {
      const hourly = res.data.HeWeather6[0].hourly
      this.props.weatherStore.setHourly(hourly)
    })
  }
  /**
   * 未来几天预报
   */
  getWeatherForecast = () => {
    const {
      addressStore: { location }
    } = this.props
    return Taro.request({
      url: HEFENG_BASE_URL + 'weather/forecast',
      data: {
        location: location.latitude + ',' + location.longitude,
        key: HEFENG_KEY
      }
    }).then(res => {
      const daily_forecast = res.data.HeWeather6[0].daily_forecast
      this.props.weatherStore.setDailyForecast(daily_forecast)
    })
  }
  /**
   * 生活指数
   */
  getLifestyle = () => {
    const {
      addressStore: { location }
    } = this.props
    return Taro.request({
      url: HEFENG_BASE_URL + 'weather/lifestyle',
      data: {
        location: location.latitude + ',' + location.longitude,
        key: HEFENG_KEY
      }
    }).then(res => {
      const lifestyle = res.data.HeWeather6[0].lifestyle
      this.props.weatherStore.setLifestyle(array2Object(lifestyle, 'type'))
    })
  }
  /**
   * 选择地址
   */
  chooseLocation = () => {
    Taro.chooseLocation().then(res => {
      const { addressStore } = this.props
      addressStore.setAddress(res.address)
      addressStore.setLocation({ latitude: res.latitude, longitude: res.longitude })
      this.fetchData()
    })
  }
  /**
   * 下拉刷新
   */
  onPullDownRefresh = async () => {
    Taro.vibrateShort()
    await this.fetchData()
    Taro.stopPullDownRefresh()
  }
  /**
   * 设置图表
   */
  initChart = () => {
    const { F2, canvas, width, height } = this.chartDetail
    const {
      weatherStore: { daily_forecast }
    } = this.props

    const data = daily_forecast.map(el => ({
      date: el.date,
      tmp_max: Number(el.tmp_max),
      tmp_min: Number(el.tmp_min)
    }))

    const chart = new F2.Chart({
      el: canvas,
      padding: [30, 0, 30, 0],
      syncY: true,
      width,
      height
    })
    chart.source(data)
    // 不显示坐标轴
    chart.axis(false)
    // 不显示提示
    chart.tooltip(false)
    // 画线
    chart
      .line()
      .position('date*tmp_max')
      .shape('smooth')
      .style({ stroke: '#f3cc49', lineWidth: 2 })
    chart
      .line()
      .position('date*tmp_min')
      .shape('smooth')
      .style({ stroke: '#4091f7', lineWidth: 2 })
    // 画点
    chart
      .point()
      .position('date*tmp_max')
      .style({
        stroke: '#f3cc49',
        fill: '#fff',
        lineWidth: 2,
        r: 4
      })
    chart
      .point()
      .position('date*tmp_min')
      .style({
        stroke: '#4091f7',
        fill: '#fff',
        lineWidth: 2,
        r: 4
      })

    data.map(function(obj: any) {
      // 画文本
      chart.guide().text({
        position: [obj.date, obj.tmp_max],
        content: obj.tmp_max + '°',
        style: {
          fill: '#f3cc49',
          textAlign: 'center',
          fontSize: 13
        },
        offsetY: -15
      })
      chart.guide().text({
        position: [obj.date, obj.tmp_min],
        content: obj.tmp_min + '°',
        style: {
          fill: '#4091f7',
          textAlign: 'center',
          fontSize: 13
        },
        offsetY: 15
      })
    })
    chart.render()
  }
  /**
   * 保存初始化图表所需要的信息
   */
  onChartInit = ({ detail }) => {
    this.chartDetail = detail
  }
  /**
   * 分享
   */
  onShareAppMessage(res) {
    return {
      title: '我发现一个好看的天气小程序，分享给你看看',
      path: '/pages/weather/index'
    }
  }

  render() {
    const { paddingTop, chooseLocation, onChartInit } = this
    const {
      addressStore: { address },
      weatherStore: { now, today, daily_forecast, hourly, air, lifestyle }
    } = this.props

    return (
      <View
        className="index wrapper"
        style={{ backgroundImage: 'url(' + getBackgroundByCode(now.cond_code) + ')' }}
      >
        <View className="container" style={{ paddingTop: paddingTop + 'px' }}>
          <View className="location" onClick={chooseLocation}>
            <Text className="icon icon-location" />
            <Text className="address ellipsis">{address}</Text>
          </View>
          <View className="now">
            <View className="curr-tmp">
              <Text>{now.tmp || 'N/A'}°</Text>
            </View>
            <View className="weather">
              <Text className="cond_txt">{now.cond_txt || '未知'}</Text>
              <Text className="tmp-range">
                {today.tmp_min || 'N/A'} ~ {today.tmp_max || 'N/A'}°
              </Text>
            </View>
          </View>
          <View className="detail">
            <View className="block">
              <View className="value">{air.qlty || '未知'}</View>
              <View className="label">空气</View>
            </View>
            <View className="block">
              <View className="value">{now.hum ? now.hum + '%' : '未知'}</View>
              <View className="label">湿度</View>
            </View>
            <View className="block">
              <View className="value">
                {now.wind_dir ? `${now.wind_dir} ${now.wind_sc}级` : '未知'}
              </View>
              <View className="label">风向</View>
            </View>
          </View>
          {/* 时段 */}
          <ScrollView className="hourly" scrollX>
            <View className="content">
              {hourly.map(el => {
                return (
                  <View className="item" key={el.date}>
                    <Text>{dateFormat(el.time, 'hh:mm')}</Text>
                    <WeatherIcon cond_code={el.cond_code} />
                    <Text>{el.cond_txt}</Text>
                  </View>
                )
              })}
            </View>
          </ScrollView>
          {/* 七天内 */}
          <View className="week">
            <View className="top">
              {daily_forecast.map(el => {
                return (
                  <View className="item" key={el.date}>
                    <Text>{getDayOfWeek(el.date)}</Text>
                    <WeatherIcon cond_code={el.cond_code_d} />
                    <Text>{el.cond_txt_d}</Text>
                  </View>
                )
              })}
            </View>
            <ff-canvas canvas-id="line-chart" onInit={onChartInit} />
            <View className="bottom">
              {daily_forecast.map(el => {
                return (
                  <View className="item" key={el.date}>
                    <WeatherIcon cond_code={el.cond_code_n} />
                    <Text>{el.cond_txt_n}</Text>
                    {/* <Text>{el.wind_dir}</Text> */}
                  </View>
                )
              })}
            </View>
            {/* 由于图表会阻碍滑动，这里放个View覆盖一下 */}
            <CoverView className="mask" />
          </View>
          <View className="lifestyle">
            <View className="item">
              <Text className="icon icon-1153" />
              <View className="text-content">
                <Text>舒适度指数 {lifestyle.comf.brf}</Text>
                <Text>{lifestyle.comf.txt}</Text>
              </View>
            </View>
            <View className="item">
              <Text className="icon icon-yifu" />
              <View className="text-content">
                <Text>穿衣指数 {lifestyle.drsg.brf}</Text>
                <Text>{lifestyle.drsg.txt}</Text>
              </View>
            </View>
            <View className="item">
              <Text className="icon icon-ganmaozhishu" />
              <View className="text-content">
                <Text>感冒指数 {lifestyle.flu.brf}</Text>
                <Text>{lifestyle.flu.txt}</Text>
              </View>
            </View>
            <View className="item">
              <Text className="icon icon-paobu" />
              <View className="text-content">
                <Text>运动指数 {lifestyle.sport.brf}</Text>
                <Text>{lifestyle.sport.txt}</Text>
              </View>
            </View>
            <View className="item">
              <Text className="icon icon-lvyou" />
              <View className="text-content">
                <Text>旅游指数 {lifestyle.trav.brf}</Text>
                <Text>{lifestyle.trav.txt}</Text>
              </View>
            </View>
            <View className="item">
              <Text className="icon icon-ziwaixian" />
              <View className="text-content">
                <Text>紫外线指数 {lifestyle.uv.brf}</Text>
                <Text>{lifestyle.uv.txt}</Text>
              </View>
            </View>
            <View className="item">
              <Text className="icon icon-che" />
              <View className="text-content">
                <Text>洗车 {lifestyle.cw.brf}</Text>
                <Text>{lifestyle.cw.txt}</Text>
              </View>
            </View>
            <View className="item">
              <Text className="icon icon-wuranyuan" />
              <View className="text-content">
                <Text>空气污染扩散条件指数 {lifestyle.air.brf}</Text>
                <Text>{lifestyle.air.txt}</Text>
              </View>
            </View>
          </View>
          <Image className="bottom-text" src="https://s2.ax1x.com/2019/07/31/etMkhF.png" />
        </View>
      </View>
    )
  }
}

export default Weather as ComponentType
