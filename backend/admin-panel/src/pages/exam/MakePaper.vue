<template>
  <div class="make-paper-page">
    <!-- 查看模式控制栏 -->
    <div v-if="isViewMode" class="view-mode-bar">
      <div class="view-mode-left">
        <el-button @click="exitViewMode">← 返回</el-button>
        <span class="view-paper-name">{{ viewPaperName }}</span>
      </div>
      <div class="view-mode-right">
        <el-button type="primary" @click="printPaper" native-type="button">打印 / 导出 PDF</el-button>
      </div>
    </div>

    <div v-if="!isViewMode" class="bread">
      <span>当前位置：</span>
      <a href="javascript:void(0)" class="active">组卷中心</a>
    </div>

    <div class="paper-content-wrapper">
      <div v-if="!isViewMode" class="cleft paper-2020">
      <div class="mb15 bg-fff pv15">
        <div class="action-bar">
          <a href="javascript:void(0)" class="btn-new btn-blue btn-fix-lg" @click="showExportDialog = true">
            <i class="p-new-icon p-new-icon-05 p-new-icon-05-16"></i>
            <span>下载组卷</span>
          </a>
          <a href="javascript:void(0)" class="btn-new btn-empty btn-fix-lg" @click="completePaper" title="点击完成组卷后，试卷将保存到我的组卷中，并且试题篮清空为0。">
            <i class="p-new-icon p-new-icon-05 p-new-icon-05-03"></i>
            <span>完成组卷</span>
          </a>
          <div class="action-divider"></div>
          <div class="action-icons">
            <a href="javascript:void(0)" class="action-icon-link" @click="savePaper" title="暂存组卷">
              <i class="p-new-icon p-new-icon-03 p-new-icon-03-01"></i>
              <span>暂存</span>
            </a>
            <a href="javascript:void(0)" class="action-icon-link" @click="openAnalyze" title="试卷分析">
              <i class="p-new-icon p-new-icon-03 p-new-icon-03-02"></i>
              <span>分析</span>
            </a>
            <a href="javascript:void(0)" class="action-icon-link" @click="downAnswerCard" title="下载答题卡">
              <i class="p-new-icon p-new-icon-03 p-new-icon-03-10"></i>
              <span>答题卡</span>
            </a>
          </div>
        </div>
      </div>
      
      <div class="bg-fff paper-info">
        <div class="new-paper-head">
          <h3 class="bdee8ff c4680fe clearfix">
            <span class="blue-box-tlt f16 fleft">组卷信息</span>
            <span class="fright">
              <input type="checkbox" v-model="paperForm.isPublic" />公开
            </span>
          </h3>
        </div>
        <div class="paper-cont">
          <ul class="radio-list-new clearfix mt10">
            <li><span>难度：<em>{{ averageDifficulty.toFixed(2) }}</em></span></li>
            <li><span>分数：<em>{{ totalScore }}</em></span></li>
            <li>
              <a href="javascript:void(0)" @click="setScore">
                <i class="p-new-icon p-new-icon-05 p-new-icon-05-10 mr5"></i>
                <span>分值设置</span>
              </a>
            </li>
          </ul>
        </div>
        
        <div class="bg-fff paper-info mb15">
          <div class="paper-head">
            <h3 class="bdee8ff c4680fe clearfix">
              <span class="blue-box-tlt f16 fleft">卷参设置</span>
              <a href="javascript:void(0)" class="fright mr10 f12" @click="toggleCheckboxList">
                编辑<i class="icon i-blue-down" style="margin-left:5px;"></i>
              </a>
            </h3>
          </div>
          <div class="paper-cont pv20">
            <ul class="radio-list clearfix p20 mb10">
              <li><label><input type="radio" value="1" v-model="paperForm.paperStyle" />简易</label></li>
              <li><label><input type="radio" value="2" v-model="paperForm.paperStyle" />普通</label></li>
              <li><label><input type="radio" value="3" v-model="paperForm.paperStyle" />正式</label></li>
            </ul>
            <ul class="checkbox-list clearfix p20 tl" :style="{ display: showCheckboxList ? '' : 'none' }">
              <li><label><input type="checkbox" v-model="paperForm.showSubtitle" />副标题</label></li>
              <li><label><input type="checkbox" v-model="paperForm.showTestInfo" />试卷信息</label></li>
              <li><label><input type="checkbox" v-model="paperForm.showStudentInfo" />考生信息</label></li>
              <li><label><input type="checkbox" v-model="paperForm.showPartHead" />分卷及注释</label></li>
              <li><label><input type="checkbox" v-model="paperForm.showScore" />总分栏</label></li>
              <li><label><input type="checkbox" v-model="paperForm.showCateScore" />大题评分区</label></li>
              <li><label><input type="checkbox" v-model="paperForm.showSeal" />装订线</label></li>
              <li><label><input type="checkbox" v-model="paperForm.showNotice" />注意事项</label></li>
              <li><label><input type="checkbox" v-model="paperForm.showMarkTag" />保密标记</label></li>
              <li><label><input type="checkbox" v-model="paperForm.showSource" />显示来源</label></li>
            </ul>
          </div>
        </div>
        
        <div class="cut-border"></div>
        
        <div class="paper-cont">
          <div class="new-paper-head" style="padding: 15px 0 7px 0;">
            <h3 class="bdee8ff c4680fe clearfix">
              <span class="blue-box-tlt f16 fleft">试题排序</span>
            </h3>
          </div>
          <div id="sortBox">
            <div class="v20 ui-sortable">
              <div class="tab tab-ctrl" id="group-order">
                <span 
                  :class="{ active: sortMode === 'type', title: true }" 
                  @click="sortMode = 'type'; handleSortChange()"
                >
                  按题型
                  <span class="hover_tips"><i></i>组卷内容可按题型排序;</span>
                </span>
                <span 
                  :class="{ prelative: true, title: true, active: sortMode === 'knowledge' }" 
                  @click="sortMode = 'knowledge'; handleSortChange()"
                >
                  按知识点
                  <img src="https://img.jyeoo.net/images/root/icon-vip.png" />
                  <span class="hover_tips"><i></i>组卷内容可按知识点内容排序;</span>
                </span>
                <span 
                  :class="{ prelative: true, title: true, active: sortMode === 'free' }" 
                  @click="sortMode = 'free'; handleSortChange()"
                >
                  自由排序
                  <img src="https://img.jyeoo.net/images/root/icon-vip.png" />
                  <span class="hover_tips"><i></i>组卷内容可按试题加入时间排序或任意调整试题顺序;</span>
                </span>
              </div>

              <div 
                v-for="(group, typeName) in groupedQuestions" 
                :key="typeName"
                class="divSeqGroup ques-num-new pt10"
                :data-title="`${getTypeTitle(typeName, group.length)}`"
              >
                <div class="clearfix">
                  <span class="c666 fleft pl15 gp-title" :title="getTypeTitle(typeName, group.length)">
                    {{ getTypeTitle(typeName, group.length) }}
                  </span>
                  <div class="fright">
                    <a href="javascript:void(0)" class="mr10" @click="delSeqGroup(typeName)">
                      <i class="icon i-paper-del" title="删除"></i>
                    </a>
                    <span class="degree-sort i-paper-sort" style="padding:4px;">
                      <i class="icon i-paper-sort" title="排序"></i>
                      <ul>
                        <li @click="sortByDegree(typeName, true)">难度由低到高</li>
                        <li @click="sortByDegree(typeName, false)">难度由高到低</li>
                      </ul>
                    </span>
                  </div>
                </div>
                <ul class="square-items square-items-new pl15 v10 clearfix sortable connectedSortable" style="min-height: 50px;">
                  <li 
                    v-for="(q, index) in group" 
                    :key="q.QuestionID"
                    class="SEQ_LI"
                    draggable="true"
                    @dragstart="handleDragStart($event, typeName, index)"
                    @dragover.prevent="handleDragOver($event, typeName, index)"
                    @drop="handleDrop($event, typeName, index)"
                    @dragend="handleDragEnd"
                  >
                    <a href="javascript:void(0)">{{ getGlobalIndex(typeName, index) + 1 }}</a>
                  </li>
                </ul>
              </div>
            </div>
            
            <div class="pb15 mt20" style="border-bottom: 1px dashed #dadada;">
              <a href="javascript:void(0)" class="btn btn-empty btn-sm m10" @click="goToSelect">继续挑题</a>
              <a href="javascript:void(0)" class="btn btn-empty btn-sm m10" @click="delAll">清空试题</a>
            </div>
            
            <ul class="tip tleft v15">
              <li>温馨提示：</li>
              <li>1、拖拽试题题号即可调整试题顺序；</li>
              <li>2、为了防止试题篮试题丢失，请点击<span style="color: #008afb">"暂存组卷"</span>；</li>
              <li>3、如果试卷选择公开，则网站用户可查阅到您的组卷；</li>
              <li>4、本卷难度系数等于每道试题难度系数与试题分值的加权平均值。</li>
              <li>5、试题篮试题与某份试卷重合度超过75%，则无法完成组卷，建议直接下载试卷。</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- 试卷统计 -->
      <div class="bg-fff paper-info paper-stats">
        <div class="new-paper-head">
          <h3 class="bdee8ff c4680fe clearfix">
            <span class="blue-box-tlt f16 fleft">试卷统计</span>
          </h3>
        </div>
        <div class="paper-cont">
          <!-- 题型统计 -->
          <div class="stats-section">
            <div class="stats-title">题型统计</div>
            <div class="stats-body">
              <div v-for="(data, type) in typeStats" :key="type" class="stats-row">
                <span class="stats-label">{{ type }}</span>
                <span class="stats-count">{{ data.count }}题</span>
                <span class="stats-score">{{ data.score }}分</span>
              </div>
              <div class="stats-row stats-total">
                <span class="stats-label">合计</span>
                <span class="stats-count">{{ basket.length }}题</span>
                <span class="stats-score">{{ totalScore }}分</span>
              </div>
            </div>
          </div>

          <!-- 难度统计 -->
          <div class="stats-section">
            <div class="stats-title">难度统计 <span class="stats-avg">平均难度 {{ averageDifficulty.toFixed(2) }}</span></div>
            <div class="stats-body">
              <div v-for="s in difficultyStats" :key="s.label" class="stats-row stats-diff-row">
                <span class="stats-diff-label">{{ s.label }}</span>
                <div class="stats-bar-bg">
                  <div class="stats-bar-fill" :style="{ width: s.percent + '%' }"></div>
                </div>
                <span class="stats-diff-count">{{ s.count }}题</span>
                <span class="stats-diff-percent">{{ s.percent }}%</span>
              </div>
            </div>
          </div>

          <!-- 考点统计 -->
          <div class="stats-section">
            <div class="stats-title">考点统计</div>
            <div class="stats-body">
              <div v-for="kp in knowledgeStats" :key="kp.name" class="stats-row">
                <span class="stats-label">{{ kp.name }}</span>
                <span class="stats-count">{{ kp.count }}题</span>
                <span class="stats-score">{{ kp.score }}分</span>
              </div>
              <div v-if="knowledgeStats.length === 0" class="stats-empty">暂无考点数据</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="cr-center">
      <div class="pm15 mb15 bg-fff">
        <div class="tab tab-ctrl clearfix">
          <span class="active">
            <a>试题篮1</a>
          </span>
        </div>
      </div>
      
      <div class="exam mb15" id="exportContent" style="border: 1px solid #fff;">
        <div v-if="paperForm.showSeal" id="exam-seal" class="exam-seal">
          <img src="https://img.jyeoo.net//images/peal_line.png" alt=" 装订线 " title="装订线" width="58" />
        </div>
        
        <div class="exam-main exam-main-new">
          <div class="exam-head">
            <div v-if="paperForm.showMarkTag" id="exam-marktag" class="exam-marktag" style="margin-bottom:-20px;" title="点击设置保密标记">
              <input 
                type="text" 
                v-model="paperForm.markTag" 
                class="marktag-input"
                style="border: none; background: transparent; font-size: inherit; font-weight: inherit;"
              />
            </div>
            
            <div id="exam-title" class="exam-title mt20">
              <input 
                type="text" 
                v-model="paperForm.mainTitle" 
                title="点击设置试卷主标题" 
                class="exam-maintitle" 
                placeholder="请输入4至60字的试卷名称，例如2018年中考压轴题精选或2018年XXX专题训练" 
              />
              <div v-if="paperForm.showSubtitle" id="exam-subtitle" class="exam-subtitle" title="点击设置试卷副标题">
                <input 
                  type="text" 
                  v-model="paperForm.subtitle" 
                  class="subtitle-input"
                  style="border: none; background: transparent; font-size: inherit;"
                />
              </div>
            </div>
            
            <div v-if="paperForm.showTestInfo" id="exam-testinfo" class="exam-testinfo" title="点击设置试卷信息栏">
              <input 
                type="text" 
                v-model="paperForm.testInfo" 
                class="testinfo-input"
                style="border: none; background: transparent; font-size: inherit; width: 100%;"
              />
            </div>
            
            <div v-if="paperForm.showStudentInfo" id="exam-studentinfo" class="exam-studentinfo" title="点击设置考生信息填写栏" style="position: static;">
              <input 
                type="text" 
                v-model="paperForm.studentInfo" 
                class="studentinfo-input"
                style="border: none; background: transparent; font-size: inherit; width: 100%;"
              />
            </div>
            
            <div v-if="paperForm.showScore" id="exam-score" class="exam-score" title="点击设置试卷誊分栏">
              <table align="center" border="1" cellpadding="0" cellspacing="0" class="jcui-scoretable">
                <tbody>
                  <tr>
                    <td width="80" align="center">题号</td>
                    <td v-for="(group, typeName) in groupedQuestions" :key="typeName" width="60" align="center">
                      {{ getChineseNumber(Object.keys(groupedQuestions).indexOf(typeName) + 1) }}
                    </td>
                    <td width="80" align="center">总分</td>
                  </tr>
                  <tr>
                    <td align="center">得分</td>
                    <td v-for="(group, typeName) in groupedQuestions" :key="typeName"></td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div v-if="paperForm.showNotice" id="exam-notice" class="exam-notice" title="点击设置考生注意事项栏">
              <div id="exam-noticetip" class="exam-noticetip">注意事项：</div>
              <div id="exam-noticetext" class="exam-noticetext">
                <textarea 
                  v-model="paperForm.noticeText" 
                  class="notice-textarea"
                  style="border: none; background: transparent; font-size: inherit; width: 100%; resize: none;"
                  rows="3"
                ></textarea>
              </div>
            </div>
          </div>
          
          <div class="exam-body" id="divQues">
            <div v-if="basket.length === 0" class="empty-basket" style="padding: 100px 0; text-align: center;">
              <div style="font-size: 18px; color: #999; margin-bottom: 20px;">试题篮为空，请先添加试题</div>
              <a href="javascript:void(0)" class="btn btn-blue" @click="goToSelect">去挑题</a>
            </div>

            <div v-else>
              <div 
                v-for="(group, typeName) in groupedQuestions" 
                :key="typeName"
                class="exampart"
              >
                <div v-if="paperForm.showPartHead" class="parthead">
                  <div class="partheadbox exam-parthead">
                    <div class="partname">
                      <input 
                        type="text" 
                        v-model="paperForm.partNames[typeName]" 
                        class="partname-input"
                        style="border: none; background: transparent; font-size: inherit; font-weight: inherit;"
                      />
                    </div>
                    <div class="partnote">
                      <input 
                        type="text" 
                        v-model="paperForm.partNotes[typeName]" 
                        class="partnote-input"
                        style="border: none; background: transparent; font-size: inherit;"
                      />
                    </div>
                  </div>
                </div>
                
                <div class="partbody">
                  <div class="questype groupPart_list">
                    <div class="questypehead">
                      <div class="questypeheadbox">
                        <table border="0" cellpadding="0" cellspacing="0" style="width:100%">
                          <tbody>
                            <tr>
                              <td width="1">
                                <div v-if="paperForm.showCateScore" class="jcui-catescore exam-catescore questypescore" style="width:120px">
                                  <table title="评分栏" border="1" cellpadding="0" cellspacing="0" style="border:1px solid #666;">
                                    <tbody>
                                      <tr>
                                        <td width="55" height="20" align="center">&nbsp;评卷人&nbsp;</td>
                                        <td width="55" align="center">&nbsp;得&nbsp;&nbsp;分&nbsp;</td>
                                      </tr>
                                      <tr>
                                        <td height="30" align="center">&nbsp;</td>
                                        <td>&nbsp;</td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                              <td style="text-align:left;">
                                <div class="exam-subjectnote questypetitle div-data-cate">
                                  {{ getTypeTitle(typeName, group.length) }}
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div class="markarea">
                        <div class="part-ctrl">
                          <span @click="delSeqGroup(typeName)"><i class="icon i-orange-delete"></i>删除</span>
                          <span @click="moveGroupUp(typeName)"><i class="icon i-orange-up"></i>上移</span>
                          <span @click="moveGroupDown(typeName)"><i class="icon i-orange-down"></i>下移</span>
                        </div>
                      </div>
                    </div>

                    <div class="questypebody paper">
                      <ul class="list-box sortable ulQuesGroup">
                        <li 
                          v-for="(q, index) in group" 
                          :key="q.QuestionID"
                          class="QUES_LI"
                          :data-id="q.QuestionID"
                          :data-point="q.KnowledgePointID || ''"
                          :data-pointname="q.KnowledgePoint || ''"
                          :data-cate="q.QuestionTypeCode || ''"
                          :data-catename="q.QuestionType || ''"
                          :data-dg="q.Difficulty || 0.5"
                          :data-dgname="getDifficultyName(q.Difficulty)"
                        >
                          <fieldset class="quesborder">
                            <div class="pt1">
                              <span class="qseq">{{ getGlobalIndex(typeName, index) + 1 }}．</span>
                              <span v-if="paperForm.showSource && q.ShortTitle && !isViewMode" class="q-source">（{{ q.ShortTitle }}）</span>
                              <a v-if="q.Source" href="javascript:void(0)" class="ques-source" target="_blank">{{ q.Source }}</a>
                              <span v-html="renderLatex(getQuestionStem(q))"></span>
                            </div>
                            <div v-if="getQuestionOptions(q).length > 0" class="pt2">
                              <div class="options-grid" :data-qid="q.QuestionID || q.id" :style="{ gridTemplateColumns: `repeat(${q.optionLayout || 4}, 1fr)` }">
                                <div 
                                  v-for="opt in getQuestionOptions(q)" 
                                  :key="opt.label"
                                  class="option-item"
                                >
                                  <label :class="{ s: q.Answer === opt.label }">
                                    <template v-if="q._parsedFromText">
                                      <span v-html="renderLatex(opt.text)"></span>
                                    </template>
                                    <template v-else>
                                      {{ opt.label }}．<span v-html="renderLatex(opt.text)"></span>
                                    </template>
                                  </label>
                                </div>
                              </div>
                            </div>
                          </fieldset>
                          <div class="fieldtip">
                            <div class="fieldtip-right">
                              <a class="mr20" href="javascript:void(0)" @click="openAIWrite(q)">AI改编</a>
                              <input 
                                class="input-data-score" 
                                type="text" 
                                :data-degree="q.Difficulty || 0.5"
                                v-model="q.score"
                                @keyup="q.score = q.score.replace(/[^\d|.]/g, '')"
                              />
                              <span>分  插入作答区</span>
                              <input class="input-data-area" type="number" v-model="q.area" @keyup="areaLimit(q)" @change="areaLimit(q)" />
                              <span>行</span>
                              <a href="javascript:void(0)" @click="viewQuestion(q)">查看解析</a>
                              <a href="javascript:void(0)" @click="moveUp(typeName, index)">上移</a>
                              <a href="javascript:void(0)" @click="moveDown(typeName, index)">下移</a>
                              <a href="javascript:void(0)" @click="removeQuestion(q)">删除</a>
                              <a href="javascript:void(0)" @click="similarQues(q)">换一题</a>
                              <span v-if="isChoiceQuestion(q)" class="layout-separator">|</span>
                              <span v-if="isChoiceQuestion(q)" class="layout-label">选项：</span>
                              <button 
                                v-if="isChoiceQuestion(q)"
                                type="button"
                                class="layout-btn-small" 
                                :class="{ active: (q.optionLayout || 4) === 4 }"
                                @click="setQuestionOptionLayout(q, 4)">
                                1×4
                              </button>
                              <button 
                                v-if="isChoiceQuestion(q)"
                                type="button"
                                class="layout-btn-small" 
                                :class="{ active: (q.optionLayout || 4) === 2 }"
                                @click="setQuestionOptionLayout(q, 2)">
                                2×2
                              </button>
                              <button 
                                v-if="isChoiceQuestion(q)"
                                type="button"
                                class="layout-btn-small" 
                                :class="{ active: (q.optionLayout || 4) === 1 }"
                                @click="setQuestionOptionLayout(q, 1)">
                                4×1
                              </button>
                            </div>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="exam-body" id="divDeleteQues" v-if="deletedQuestions.length > 0">
            <div class="exampart">
              <div class="partbody">
                <div class="exam-subjectnote questypetitle ques-line">
                  <i class="p-new-icon p-new-icon-05 p-new-icon-05-01 mr5"></i> 已删除
                </div>
                <div class="questypebody paper">
                  <ul class="list-box sortable ulQuesGroup">
                    <li 
                      v-for="(q, index) in deletedQuestions" 
                      :key="q.QuestionID"
                      class="QUES_LI"
                    >
                      <fieldset class="quesborder">
                        <div class="pt1">
                          <span class="qseq">{{ index + 1 }}．</span>
                          <span v-if="paperForm.showSource && q.ShortTitle && !isViewMode" class="q-source">（{{ q.ShortTitle }}）</span>
                          <a v-if="q.Source" href="javascript:void(0)" class="ques-source" target="_blank">{{ q.Source }}</a>
                          <span v-html="renderLatex(getQuestionStem(q))"></span>
                        </div>
                        <div v-if="getQuestionOptions(q).length > 0" class="pt2">
                          <div class="options-grid" :data-qid="q.QuestionID || q.id" :style="{ gridTemplateColumns: `repeat(${q.optionLayout || 4}, 1fr)` }">
                            <div 
                              v-for="opt in getQuestionOptions(q)" 
                              :key="opt.label"
                              class="option-item"
                            >
                              <label :class="{ s: q.Answer === opt.label }">
                                <template v-if="q._parsedFromText">
                                  <span v-html="renderLatex(opt.text)"></span>
                                </template>
                                <template v-else>
                                  {{ opt.label }}．<span v-html="renderLatex(opt.text)"></span>
                                </template>
                              </label>
                            </div>
                          </div>
                        </div>
                      </fieldset>
                      <div class="fieldtip">
                        <div class="fieldtip-right">
                          <a href="javascript:void(0)" @click="restoreQuestion(q)">恢复</a>
                          <a href="javascript:void(0)" @click="permanentDelete(q)">彻底删除</a>
                          <span v-if="isChoiceQuestion(q)" class="layout-separator">|</span>
                          <span v-if="isChoiceQuestion(q)" class="layout-label">选项：</span>
                          <button 
                            v-if="isChoiceQuestion(q)"
                            type="button"
                            class="layout-btn-small" 
                            :class="{ active: (q.optionLayout || 4) === 4 }"
                            @click="setQuestionOptionLayout(q, 4)">
                            1×4
                          </button>
                          <button 
                            v-if="isChoiceQuestion(q)"
                            type="button"
                            class="layout-btn-small" 
                            :class="{ active: (q.optionLayout || 4) === 2 }"
                            @click="setQuestionOptionLayout(q, 2)">
                            2×2
                          </button>
                          <button 
                            v-if="isChoiceQuestion(q)"
                            type="button"
                            class="layout-btn-small" 
                            :class="{ active: (q.optionLayout || 4) === 1 }"
                            @click="setQuestionOptionLayout(q, 1)">
                            4×1
                          </button>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>

    <el-dialog
      v-model="showExportDialog"
      title="导出设置"
      width="420px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form label-width="80px" label-position="left">
        <el-form-item label="纸张大小">
          <el-select v-model="exportSettings.pageSize" style="width: 100%;">
            <el-option label="A3" value="a3" />
            <el-option label="A4" value="a4" />
            <el-option label="B4" value="b4" />
            <el-option label="B5" value="b5" />
            <el-option label="8K" value="8k" />
            <el-option label="16K" value="16k" />
          </el-select>
        </el-form-item>
        <el-form-item label="纸张方向">
          <el-radio-group v-model="exportSettings.orientation">
            <el-radio value="portrait">纵向</el-radio>
            <el-radio value="landscape">横向</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="版本">
          <el-radio-group v-model="exportSettings.version">
            <el-radio value="student">学生版（无答案）</el-radio>
            <el-radio value="teacher">教师版（含答案）</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="downloadPDF" :loading="isExporting" type="success">
          预览
        </el-button>
        <el-button @click="showExportDialog = false">取消</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { adminApi } from '../../api'

const router = useRouter()

const isViewMode = ref(false)
const viewPaperName = ref('')
const basket = ref([])
const deletedQuestions = ref([])

watch(basket, (newBasket) => {
  if (!isViewMode.value) {
    localStorage.setItem('math_paper_basket', JSON.stringify(newBasket))
  }
  newBasket.forEach(q => getQuestionOptions(q))
}, { deep: true })

watch(deletedQuestions, (newList) => {
  newList.forEach(q => getQuestionOptions(q))
}, { deep: true })

const paperForm = ref({
  mainTitle: `${new Date().toLocaleDateString('zh-CN')}的高中数学组卷`,
  subtitle: '试卷副标题',
  testInfo: '考试范围：xxx；考试时间：100分钟；命题人：xxx',
  studentInfo: '学校:___________姓名：___________班级：___________考号：___________',
  markTag: '绝密★启用前',
  noticeText: '1．答题前填写好自己的姓名、班级、考号等信息\n2．请将答案正确填写在答题卡上',
  isPublic: false,
  paperStyle: '1',
  showSubtitle: false,
  showTestInfo: false,
  showStudentInfo: false,
  showPartHead: true,
  showScore: true,
  showCateScore: true,
  showSeal: false,
  showNotice: true,
  showMarkTag: false,
  showSource: true,
  partNames: {},
  partNotes: {}
})

const sortMode = ref('type')
const showCheckboxList = ref(false)
const dragData = ref(null)
const showExportDialog = ref(false)
const isExporting = ref(false)

const exportSettings = reactive({
  pageSize: 'a4',
  orientation: 'portrait',
  version: 'student'
})

const setQuestionOptionLayout = (question, layout) => {
  question.optionLayout = layout
}

const autoAdjustAllOptionLayouts = () => {
  const grids = document.querySelectorAll('.options-grid')
  if (!grids.length) return
  
  grids.forEach(grid => {
    const qid = grid.getAttribute('data-qid')
    if (!qid) return
    
    let question = null
    for (const typeName in groupedQuestions.value) {
      const found = groupedQuestions.value[typeName].find(q => (q.QuestionID || q.id) === qid)
      if (found) {
        question = found
        break
      }
    }
    
    if (!question || question._autoAdjusted) return
    
    const items = grid.querySelectorAll('.option-item')
    if (!items.length) return
    
    let hasOverflow = false
    items.forEach(item => {
      const label = item.querySelector('label')
      if (label) {
        if (label.scrollHeight > label.clientHeight + 2) {
          hasOverflow = true
        }
      }
    })
    
    const currentLayout = question.optionLayout || 4
    
    if (hasOverflow && currentLayout > 1) {
      question.optionLayout = currentLayout === 4 ? 2 : 1
    }
    
    question._autoAdjusted = true
  })
}

const autoAdjustOptionLayout = (question) => {
  if (question._autoAdjusting) return
  question._autoAdjusting = true
  
  nextTick(() => {
    const grids = document.querySelectorAll(`.options-grid[data-qid="${question.QuestionID || question.id}"]`)
    if (!grids.length) {
      question._autoAdjusting = false
      return
    }
    
    const grid = grids[0]
    const items = grid.querySelectorAll('.option-item')
    if (!items.length) {
      question._autoAdjusting = false
      return
    }
    
    let hasOverflow = false
    items.forEach(item => {
      const label = item.querySelector('label')
      if (label) {
        const scrollHeight = label.scrollHeight
        const clientHeight = label.clientHeight
        if (scrollHeight > clientHeight + 2) {
          hasOverflow = true
        }
      }
    })
    
    const currentLayout = question.optionLayout || 4
    
    if (hasOverflow && currentLayout > 1) {
      const newLayout = currentLayout === 4 ? 2 : 1
      question.optionLayout = newLayout
      
      nextTick(() => {
        autoAdjustOptionLayout(question)
      })
    } else {
      delete question._autoAdjusting
    }
  })
}

const isChoiceQuestion = (q) => {
  if (q.QuestionType === '选择题' || q.QuestionType === '多选题' || q.QuestionType === '单选题') {
    return true
  }
  return getQuestionOptions(q).length > 0
}

const parseOptionsFromText = (text) => {
  if (!text) return null

  const formulaPlaceholders = []
  let protectedText = text
  const formulaRe = /(\$\$[\s\S]*?\$\$)|(\$[\s\S]+?\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\))/g
  protectedText = protectedText.replace(formulaRe, (match) => {
    const p = `__FORMULA_PH_${formulaPlaceholders.length}__`
    formulaPlaceholders.push({ p, original: match })
    return p
  })

  const lines = protectedText.split('\n').map(l => l.trim())
  
  let firstOptIdx = -1
  const optLines = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    
    let label = null
    
    const formulaMatch = line.match(/^(__FORMULA_PH_\d+__)/)
    if (formulaMatch) {
      const ph = formulaMatch[1]
      const phData = formulaPlaceholders.find(f => f.p === ph)
      if (phData && phData.original) {
        const innerMatch = phData.original.match(/\\rm\s*\{?\s*([A-D])|\\mathrm\s*\{?\s*([A-D])|\(([A-D])\)|（([A-D])）/)
        if (innerMatch) {
          label = innerMatch[1] || innerMatch[2] || innerMatch[3] || innerMatch[4]
        }
      }
    }
    
    if (!label) {
      const bracketMatch = line.match(/^[（(]\s*([A-D])\s*[）)]/)
      if (bracketMatch) {
        label = bracketMatch[1]
      }
    }
    
    if (!label) {
      const dotMatch = line.match(/^([A-D])\s*[．.、]/)
      if (dotMatch) {
        label = dotMatch[1]
      }
    }
    
    if (label) {
      if (firstOptIdx < 0) firstOptIdx = i
      optLines.push({ idx: i, label, text: lines[i] })
    }
  }
  
  if (optLines.length < 3) return null

  const alpha = 'ABCDEFGH'
  const startIdx = alpha.indexOf(optLines[0].label)
  if (startIdx < 0) return null
  
  let valid = true
  for (let i = 1; i < optLines.length; i++) {
    if (optLines[i].label !== alpha[startIdx + i]) {
      valid = false
      break
    }
  }
  if (!valid) return null

  const stemLines = lines.slice(0, firstOptIdx)
  let stem = stemLines.join('\n')
  formulaPlaceholders.forEach(({ p, original }) => {
    stem = stem.replace(p, original)
  })

  const options = []
  for (let i = 0; i < optLines.length; i++) {
    let optText = optLines[i].text
    formulaPlaceholders.forEach(({ p, original }) => {
      optText = optText.replace(p, original)
    })
    options.push({ label: optLines[i].label, text: optText })
  }

  return { stem: stem || '', options }
}

const getQuestionOptions = (q) => {
  if (q._parsedOptions) return q._parsedOptions
  
  if (q.options && Array.isArray(q.options) && q.options.length > 0) {
    q._parsedOptions = q.options
    q._hasSeparateOptions = true
    return q.options
  }
  
  if (q.options && typeof q.options === 'string' && q.options !== '{}') {
    try {
      const parsed = JSON.parse(q.options)
      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        const options = Object.entries(parsed).map(([label, text]) => ({ label, text }))
        q._parsedOptions = options
        q._hasSeparateOptions = true
        return options
      }
    } catch (e) {}
  }
  
  const parsed = parseOptionsFromText(q.QuestionText)
  if (parsed) {
    q._parsedOptions = parsed.options
    q._parsedStem = parsed.stem
    q._parsedFromText = true
    return parsed.options
  }
  
  return []
}

const getQuestionStem = (q) => {
  if (q._hasSeparateOptions) {
    return q.QuestionText || ''
  }
  if (q._parsedFromText) {
    return q._parsedStem || ''
  }
  if (q._parsedStem) {
    return q._parsedStem
  }
  const options = getQuestionOptions(q)
  if (q._parsedFromText) {
    return q._parsedStem || ''
  }
  return q.QuestionText || ''
}

const renderLatex = (text) => {
  if (!text) return ''
  const placeholders = []
  const createPlaceholder = (content, type = 'html') => {
    const p = `__LATEX_JS_${type.toUpperCase()}_PH_${placeholders.length}__`
    placeholders.push({ p, content, type })
    return p
  }

  let currentText = text.trim().replace(/\t/g, ' ').replace(/ {2,}/g, ' ')
  
  currentText = currentText.replace(/[\uE000-\uF8FF]/g, (char) => {
    const code = char.charCodeAt(0)
    console.log('[renderLatex] Private Use char: 0x' + code.toString(16) + ' (' + code + ')')
    const offset = code - 0xE000
    const map = {
      0x21: '<',
      0x22: '>',
      0x3D: '=',
      0x2B: '+',
      0x2D: '-',
      0xB7: '·',
      0xD7: '×',
      0xF7: '÷',
    }
    if (map[offset]) {
      console.log('[renderLatex] Mapped to:', map[offset])
      return map[offset]
    }
    return char
  })
  
  currentText = currentText
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
  
  const formulaPlaceholders = []
  let formulaRegex
  try {
    formulaRegex = /(\$\$[\s\S]*?\$\$)|((?<!\\)\$([\s\S]+?)(?<!\\)\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\])/g
  } catch (e) {
    formulaRegex = /(\$\$[\s\S]*?\$\$)|(\$([\s\S]+?)\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\])/g
  }
  
  currentText = currentText.replace(formulaRegex, (match) => {
    const cleanedFormula = match.replace(/\n/g, ' ')
    const p = `__FORMULA_TEMP_${formulaPlaceholders.length}__`
    formulaPlaceholders.push({ p, original: match, cleaned: cleanedFormula })
    return p
  })
  
  formulaPlaceholders.forEach(({ p, cleaned }) => {
    currentText = currentText.replace(p, cleaned)
  })
  
  let mathRegex
  try {
    mathRegex = /(\$\$[\s\S]*?\$\$)|((?<!\\)\$([\s\S]+?)(?<!\\)\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\])/g
  } catch (e) {
    mathRegex = /(\$\$[\s\S]*?\$\$)|(\$([\s\S]+?)\$)|(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\])/g
  }
  
  currentText = currentText.replace(mathRegex, (match, p1, p2, p3, p4, p5) => {
    let expression = ''
    let displayMode = false
    
    if (p1) {
      expression = p1.slice(2, -2)
      displayMode = true
    } else if (p2) {
      expression = p3
      displayMode = false
    } else if (p4) {
      expression = p4.slice(2, -2)
      displayMode = true
    } else if (p5) {
      expression = p5.slice(2, -2)
      displayMode = false
    }
    
    if (!expression.trim()) return match
    
    try {
      const rendered = katex.renderToString(expression, {
        throwOnError: false,
        displayMode: displayMode,
        strict: false
      })
      return createPlaceholder(rendered, 'math')
    } catch (e) {
      console.warn('KaTeX render error:', e)
      return match
    }
  })

  currentText = currentText
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")

  currentText = currentText
    .replace(/《答案》/g, '<span class="custom-tag answer">【答案】</span>')
    .replace(/《\/答案》/g, '')
    .replace(/《分析》/g, '<span class="custom-tag analysis">【思路分析】</span>')
    .replace(/《\/分析》/g, '')
    .replace(/《点评》/g, '<span class="custom-tag commentary">【点评】</span>')
    .replace(/《\/点评》/g, '')
    .replace(/《注释》/g, '<span class="custom-tag note">')
    .replace(/《\/注释》/g, '</span>')
    .replace(/《步骤》/g, '<span class="custom-tag step">【步骤】</span>')
    .replace(/《\/步骤》/g, '')

  currentText = currentText
    .replace(/\\color\{#([0-9A-Fa-f]{6})\}\{([^}]+)\}/g, '<span style="color:#$1;">$2</span>')
    .replace(/\\bold\{([^}]+)\}/g, '<b>$1</b>')
    .replace(/\\mathbf\{([^}]+)\}/g, '<b>$1</b>')

  currentText = currentText.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (match, alt, url) => {
      let decodedUrl = url
      try {
        decodedUrl = decodeURIComponent(url)
      } catch (e) {}
      const cleanUrl = decodedUrl.replace(/(_yjs|_thumb|_small|_medium|_large)(\?.*)?$/i, '$2')
      return `<img src="${cleanUrl}" alt="${alt}" style="max-width:100%;height:auto;display:block;margin:10px 0;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" onerror="this.style.display='none'" />`
    }
  )

  currentText = currentText.replace(
    /(https?:\/\/[^\s<>"]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp))(?:_yjs|_thumb|_small|_medium|_large)?(?!["'])/gi,
    (match, url) => {
      const cleanUrl = url.replace(/(_yjs|_thumb|_small|_medium|_large)$/i, '')
      return `<img src="${cleanUrl}" style="max-width:100%;height:auto;display:block;margin:10px 0;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" onerror="this.style.display='none'" />`
    }
  )

  currentText = currentText.replace(/\\neq?(?!\s*[a-zA-Z])/g, (match) => {
    try {
      return katex.renderToString('\\neq', { throwOnError: false, displayMode: false })
    } catch (e) {
      return '≠'
    }
  })

  currentText = currentText.replace(/≠/g, (match) => {
    try {
      return katex.renderToString('\\neq', { throwOnError: false, displayMode: false })
    } catch (e) {
      return match
    }
  })

  currentText = currentText.replace(/≤/g, (match) => {
    try {
      return katex.renderToString('\\leq', { throwOnError: false, displayMode: false })
    } catch (e) {
      return match
    }
  })

  currentText = currentText.replace(/≥/g, (match) => {
    try {
      return katex.renderToString('\\geq', { throwOnError: false, displayMode: false })
    } catch (e) {
      return match
    }
  })

  placeholders.forEach(({ p, content }) => {
    currentText = currentText.replace(p, content)
  })

  const svgPlaceholders = []
  currentText = currentText.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, (match) => {
    const p = `__SVG_PLACEHOLDER_${svgPlaceholders.length}__`
    svgPlaceholders.push({ p, content: match })
    return p
  })

  currentText = currentText.replace(/\n/g, '<br>')

  svgPlaceholders.forEach(({ p, content }) => {
    currentText = currentText.replace(p, content)
  })

  return currentText
}

const groupedQuestions = computed(() => {
  basket.value.forEach(q => getQuestionOptions(q))
  
  if (sortMode.value === 'type') {
    const groups = {}
    basket.value.forEach(q => {
      const type = q.QuestionType || '其他'
      if (!groups[type]) {
        groups[type] = []
      }
      groups[type].push(q)
    })
    return groups
  } else if (sortMode.value === 'knowledge') {
    const groups = {}
    basket.value.forEach(q => {
      const kp = q.KnowledgePoint || '其他'
      if (!groups[kp]) {
        groups[kp] = []
      }
      groups[kp].push(q)
    })
    return groups
  } else {
    return { '全部试题': [...basket.value] }
  }
})

const averageDifficulty = computed(() => {
  if (basket.value.length === 0) return 0
  const total = basket.value.reduce((sum, q) => {
    return sum + (q.Difficulty || 0.5)
  }, 0)
  return total / basket.value.length
})

const totalScore = computed(() => {
  return basket.value.reduce((sum, q) => {
    return sum + (parseFloat(q.score) || 5)
  }, 0)
})

// 题型统计
const typeStats = computed(() => {
  const stats = {}
  basket.value.forEach(q => {
    const type = q.QuestionType || '其他'
    if (!stats[type]) {
      stats[type] = { count: 0, score: 0 }
    }
    stats[type].count++
    stats[type].score += parseFloat(q.score) || 5
  })
  return stats
})

// 难度统计
const difficultyLabels = ['易', '较易', '中档', '较难', '难']
const difficultyRanges = [
  { min: 0, max: 0.3 },
  { min: 0.3, max: 0.5 },
  { min: 0.5, max: 0.7 },
  { min: 0.7, max: 0.9 },
  { min: 0.9, max: 1.0 }
]
const difficultyStats = computed(() => {
  const stats = difficultyLabels.map(label => ({ label, count: 0, percent: 0 }))
  if (basket.value.length === 0) return stats
  basket.value.forEach(q => {
    const d = q.Difficulty || 0.5
    for (let i = 0; i < difficultyRanges.length; i++) {
      const range = difficultyRanges[i]
      if (d >= range.min && d <= range.max) {
        stats[i].count++
        break
      }
    }
  })
  stats.forEach(s => {
    s.percent = basket.value.length > 0 ? Math.round((s.count / basket.value.length) * 100) : 0
  })
  return stats
})

// 考点统计
const knowledgeStats = computed(() => {
  const stats = {}
  basket.value.forEach(q => {
    // 优先用 KPTitles（API 返回的关联考点名称），回退到 LinkNames，再回退到 KnowledgePoint
    const raw = q.KPTitles || q.LinkNames || q.KnowledgePoint || ''
    const names = raw
      ? raw.split(/[,，、]/).map(s => s.trim()).filter(Boolean)
      : ['未分类']
    names.forEach(name => {
      if (!stats[name]) {
        stats[name] = { count: 0, score: 0 }
      }
      stats[name].count++
      stats[name].score += parseFloat(q.score) || 5
    })
  })
  return Object.entries(stats)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count)
})

const getTypeTitle = (typeName, count) => {
  const index = Object.keys(groupedQuestions.value).indexOf(typeName)
  const chineseNum = getChineseNumber(index + 1)
  return `${chineseNum}．${typeName}（共${count}小题）`
}

const getChineseNumber = (num) => {
  const chineseNums = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  return chineseNums[num - 1] || num
}

const getDifficultyName = (difficulty) => {
  if (!difficulty) return '中'
  if (difficulty < 0.4) return '易'
  if (difficulty < 0.7) return '中'
  return '难'
}

const getGlobalIndex = (typeName, localIndex) => {
  let index = 0
  for (const key in groupedQuestions.value) {
    if (key === typeName) {
      return index + localIndex
    }
    index += groupedQuestions.value[key].length
  }
  return localIndex
}

const toggleCheckboxList = () => {
  showCheckboxList.value = !showCheckboxList.value
}

const handleSortChange = () => {
  ElMessage.success(`已切换为${sortMode.value === 'type' ? '按题型' : sortMode.value === 'knowledge' ? '按知识点' : '自由'}排序`)
}

const sortByDegree = (typeName, ascending) => {
  const group = groupedQuestions.value[typeName]
  if (!group) return
  
  group.sort((a, b) => {
    const diffA = a.Difficulty || 0.5
    const diffB = b.Difficulty || 0.5
    return ascending ? diffA - diffB : diffB - diffA
  })
  
  ElMessage.success(`已按难度${ascending ? '由低到高' : '由高到低'}排序`)
}

const handleDragStart = (e, typeName, index) => {
  if (sortMode.value !== 'free') {
    ElMessage.warning('自由排序模式下才能拖拽调整顺序')
    return
  }
  dragData.value = { typeName, index }
  e.dataTransfer.effectAllowed = 'move'
}

const handleDragOver = (e, typeName, index) => {
  if (sortMode.value !== 'free') return
  e.dataTransfer.dropEffect = 'move'
}

const handleDrop = (e, targetTypeName, targetIndex) => {
  if (sortMode.value !== 'free' || !dragData.value) return
  
  const sourceIndex = dragData.value.index
  const targetGlobalIndex = getGlobalIndex(targetTypeName, targetIndex)
  const sourceGlobalIndex = getGlobalIndex(dragData.value.typeName, sourceIndex)
  
  if (sourceGlobalIndex !== targetGlobalIndex) {
    const item = basket.value.splice(sourceGlobalIndex, 1)[0]
    basket.value.splice(targetGlobalIndex, 0, item)
    ElMessage.success('试题顺序已调整')
  }
}

const handleDragEnd = () => {
  dragData.value = null
}

const removeQuestion = (q) => {
  const idx = basket.value.findIndex(item => item.QuestionID === q.QuestionID)
  if (idx > -1) {
    const removed = basket.value.splice(idx, 1)[0]
    deletedQuestions.value.push(removed)
    ElMessage.success('已从试题篮移除')
  }
}

const restoreQuestion = (q) => {
  const idx = deletedQuestions.value.findIndex(item => item.QuestionID === q.QuestionID)
  if (idx > -1) {
    const restored = deletedQuestions.value.splice(idx, 1)[0]
    basket.value.push(restored)
    ElMessage.success('已恢复到试题篮')
  }
}

const permanentDelete = (q) => {
  const idx = deletedQuestions.value.findIndex(item => item.QuestionID === q.QuestionID)
  if (idx > -1) {
    deletedQuestions.value.splice(idx, 1)
    ElMessage.success('已彻底删除')
  }
}

const viewQuestion = (q) => {
  router.push(`/user-exam/math-paper/${q.QuestionID}`)
}

const goToSelect = () => {
  router.push('/user-exam/math-paper')
}

const delAll = () => {
  ElMessageBox.confirm('确定要清空所有试题吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    basket.value = []
    ElMessage.success('已清空试题篮')
  }).catch(() => {})
}

const delSeqGroup = (typeName) => {
  ElMessageBox.confirm(`确定要删除所有${typeName}题目吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    basket.value = basket.value.filter(q => {
      if (sortMode.value === 'type') {
        return q.QuestionType !== typeName
      } else if (sortMode.value === 'knowledge') {
        return q.KnowledgePoint !== typeName
      }
      return true
    })
    ElMessage.success(`已删除所有${typeName}题目`)
  }).catch(() => {})
}

const moveGroupUp = (typeName) => {
  const types = Object.keys(groupedQuestions.value)
  const currentIndex = types.indexOf(typeName)
  if (currentIndex > 0) {
    const prevType = types[currentIndex - 1]
    const currentGroup = groupedQuestions.value[typeName]
    const prevGroup = groupedQuestions.value[prevType]
    
    const currentStart = basket.value.findIndex(q => {
      if (sortMode.value === 'type') return q.QuestionType === typeName
      if (sortMode.value === 'knowledge') return q.KnowledgePoint === typeName
      return true
    })
    const prevStart = basket.value.findIndex(q => {
      if (sortMode.value === 'type') return q.QuestionType === prevType
      if (sortMode.value === 'knowledge') return q.KnowledgePoint === prevType
      return true
    })
    
    const currentItems = basket.value.splice(currentStart, currentGroup.length)
    basket.value.splice(prevStart, 0, ...currentItems)
    
    ElMessage.success('已上移')
  }
}

const moveGroupDown = (typeName) => {
  const types = Object.keys(groupedQuestions.value)
  const currentIndex = types.indexOf(typeName)
  if (currentIndex < types.length - 1) {
    const nextType = types[currentIndex + 1]
    const currentGroup = groupedQuestions.value[typeName]
    const nextGroup = groupedQuestions.value[nextType]
    
    const currentStart = basket.value.findIndex(q => {
      if (sortMode.value === 'type') return q.QuestionType === typeName
      if (sortMode.value === 'knowledge') return q.KnowledgePoint === typeName
      return true
    })
    const nextStart = basket.value.findIndex(q => {
      if (sortMode.value === 'type') return q.QuestionType === nextType
      if (sortMode.value === 'knowledge') return q.KnowledgePoint === nextType
      return true
    })
    
    const currentItems = basket.value.splice(currentStart, currentGroup.length)
    basket.value.splice(nextStart + nextGroup.length - currentGroup.length, 0, ...currentItems)
    
    ElMessage.success('已下移')
  }
}

const moveUp = (typeName, index) => {
  const globalIndex = getGlobalIndex(typeName, index)
  if (globalIndex > 0) {
    const item = basket.value.splice(globalIndex, 1)[0]
    basket.value.splice(globalIndex - 1, 0, item)
    ElMessage.success('已上移')
  }
}

const moveDown = (typeName, index) => {
  const globalIndex = getGlobalIndex(typeName, index)
  if (globalIndex < basket.value.length - 1) {
    const item = basket.value.splice(globalIndex, 1)[0]
    basket.value.splice(globalIndex + 1, 0, item)
    ElMessage.success('已下移')
  }
}

const similarQues = (q) => {
  ElMessage.info('换一题功能开发中...')
}

const openAIWrite = (q) => {
  ElMessage.info('AI改编功能开发中...')
}

const areaLimit = (q) => {
  if (q.area < 0) q.area = 0
  if (q.area > 50) q.area = 50
}

const beforeExport = () => {
  const examEl = document.getElementById('exportContent')
  if (!examEl) return
  examEl.classList.add('exporting')
  isExporting.value = true
}

const afterExport = () => {
  const examEl = document.getElementById('exportContent')
  if (!examEl) return
  examEl.classList.remove('exporting')
  isExporting.value = false
}

const transformText = (text) => {
  if (!text) return ''

  let content = text.trim()
    .replace(/＄/g, '$')
    .replace(/\.\$png/g, '.png')

  const latexBlocks = []

  content = content.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
    latexBlocks.push(match)
    return `__LATEX_BLOCK_${latexBlocks.length - 1}__`
  })

  content = content.replace(/\$[^\$]+\$/g, (match) => {
    latexBlocks.push(match)
    return `__LATEX_INLINE_${latexBlocks.length - 1}__`
  })

  content = content.replace(/\\\([\s\S]*?\\\)/g, (match) => {
    latexBlocks.push(match)
    return `__LATEX_PAREN_${latexBlocks.length - 1}__`
  })

  content = content.replace(/\\\[[\s\S]*?\\\]/g, (match) => {
    latexBlocks.push(match)
    return `__LATEX_BRACKET_${latexBlocks.length - 1}__`
  })

  const latexCommands = []
  const latexCmdPattern = /\\\\?(neq?|nu|ni|not|nabla|neg|nmid|nparallel|nsubseteq|nsupseteq|ncong|nsim|napprox|nless|ngtr|nleq|ngeq|nprec|nsucc|nvdash|nVdash|ntriangleleft|ntriangleright)(?=[a-zA-Z{}\\\s$]|$)/g
  content = content.replace(latexCmdPattern, (match) => {
    latexCommands.push(match)
    return `__LATEX_CMD_${latexCommands.length - 1}__`
  })

  content = content.replace(/\\r\\n/g, '\n')
  content = content.replace(/\\n/g, '\n')

  content = content.replace(/__LATEX_CMD_(\d+)__/g, (match, index) => latexCommands[index])

  content = content.replace(/\\\\\(/g, '\\(').replace(/\\\\\)/g, '\\)')
  content = content.replace(/\\\\\[/g, '\\[').replace(/\\\\\]/g, '\\]')

  content = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(match, alt, url) {
    let cleanUrl = url.replace(/(_yjs|_thumb|_small|_medium|_large)(\?.*)?$/i, '$2')
    return '<div style="width:50%;"><img src="' + cleanUrl + '" style="max-width:100%;height:auto;display:block;margin:5px 0;" alt="' + alt + '" /></div>'
  })

  content = content.replace(/(https?:\/\/[^\s<>"]+?\.(?:png|jpg|jpeg|gif|webp))(?:_[a-zA-Z0-9]+)?(?![^<]*>)/gi, function(match, url) {
    if (match.includes('<img')) return match
    return '<div style="width:50%;"><img src="' + url + '" style="max-width:100%;height:auto;display:block;margin:5px 0;" alt="题目图片" /></div>'
  })

  const answerLabelStyle = 'color:#fff;background-color:#009688;padding:1px 6px;margin-right:6px;border-radius:4px;font-size:12px;'
  const analysisLabelStyle = 'color:#fff;background-color:#009688;padding:1px 6px;margin-right:6px;border-radius:4px;font-size:12px;'

  content = content.replace(/《答案》\s*【答案】\s*《\/答案》/g, `<span style="${answerLabelStyle}">答案</span>`)
  content = content.replace(/《答案》\s*【证明】\s*《\/答案》/g, `<span style="${answerLabelStyle}">证明</span>`)
  content = content.replace(/《答案》\s*【解析】\s*《\/答案》/g, `<span style="${answerLabelStyle}">答案</span>`)
  content = content.replace(/《答案》([\s\S]*?)《\/答案》/g, '<span style="' + answerLabelStyle + '">答案</span>$1')

  content = content.replace(/《分析》\s*【解析】\s*《\/分析》/g, `<span style="${analysisLabelStyle}">解析</span>`)
  content = content.replace(/《分析》\s*【思路分析】\s*《\/分析》/g, `<span style="${analysisLabelStyle}">思路分析</span>`)
  content = content.replace(/《分析》([\s\S]*?)《\/分析》/g, '<span style="' + analysisLabelStyle + '">分析</span><span style="color:#009688;">$1</span>')

  content = content.replace(/《注释》([\s\S]*?)《\/注释》/g, '<span style="color:#009688;">$1</span>')
  content = content.replace(/《步骤》([\s\S]*?)《\/步骤》/g, '<span style="color:#FF9800;font-weight:bold;">$1</span>')
  content = content.replace(/《点评》[\s\S]*?《\/点评》/g, '')
  content = content.replace(/【欧几里得[^】]*?】/g, '')
  content = content.replace(/【命题人[^】]*?】/g, '')

  content = content.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  content = content.replace(/^## (.+)$/gm, '<h3>$1</h3>')
  content = content.replace(/^# (.+)$/gm, '<h3>$1</h3>')

  content = content.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
  content = content.replace(/`([^`]+)`/g, '<code>$1</code>')

  content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  content = content.replace(/\*([^*]+)\*/g, '<em>$1</em>')

  content = content.replace(/\n/g, '<br/>')

  content = content.replace(/__LATEX_BLOCK_(\d+)__/g, (match, index) => latexBlocks[index])
  content = content.replace(/__LATEX_INLINE_(\d+)__/g, (match, index) => latexBlocks[index])
  content = content.replace(/__LATEX_PAREN_(\d+)__/g, (match, index) => latexBlocks[index])
  content = content.replace(/__LATEX_BRACKET_(\d+)__/g, (match, index) => latexBlocks[index])

  return content
}

const downloadPaper = () => {
  if (basket.value.length === 0) {
    ElMessage.warning('试题篮为空，无法下载')
    return
  }
  showExportDialog.value = true
}

const downloadPDF = async () => {
  if (basket.value.length === 0) {
    ElMessage.warning('试题篮为空，无法导出')
    return
  }

  beforeExport()

  try {
    await nextTick()

    const isTeacher = exportSettings.version === 'teacher'

    const questionDetailsMap = {}
    if (isTeacher) {
      ElMessage.info('正在获取解析数据...')
      const detailPromises = basket.value.map(async (q) => {
        const qid = q.QuestionID || q.id
        if (!qid) return
        try {
          const res = await adminApi.getMathQuestionDetail(qid)
          if (res.code === 0 && res.data) {
            questionDetailsMap[qid] = {
              question: res.data.question,
              details: res.data.details || []
            }
          }
        } catch (err) {
          console.warn(`获取题目 ${qid} 详情失败:`, err)
        }
      })
      await Promise.all(detailPromises)
    }

    const previewData = {
      questions: basket.value,
      detailsMap: questionDetailsMap,
      groupedQuestions: groupedQuestions.value,
      paperForm: { ...paperForm.value },
      version: exportSettings.version,
      pageSize: exportSettings.pageSize,
      orientation: exportSettings.orientation
    }

    sessionStorage.setItem('paper_preview_data', JSON.stringify(previewData))

    showExportDialog.value = false

    const previewUrl = window.location.origin + window.location.pathname + '#/exam/paper-preview'
    const printWindow = window.open(previewUrl, '_blank', 'width=1200,height=800')
    if (!printWindow) {
      ElMessage.error('请允许弹出窗口，以便预览试卷')
    }

  } catch (e) {
    console.error('PDF export error:', e)
    ElMessage.error('PDF导出失败：' + e.message)
  } finally {
    afterExport()
  }
}

const savePaper = () => {
  if (basket.value.length === 0) {
    ElMessage.warning('试题篮为空，无法保存')
    return
  }
  
  const paperData = {
    ...paperForm.value,
    questions: basket.value,
    savedAt: new Date().toISOString()
  }
  
  const savedPapers = JSON.parse(localStorage.getItem('saved_papers') || '[]')
  savedPapers.push(paperData)
  localStorage.setItem('saved_papers', JSON.stringify(savedPapers))
  
  ElMessage.success('组卷已暂存')
}

const completePaper = () => {
  if (basket.value.length === 0) {
    ElMessage.warning('试题篮为空，无法完成组卷')
    return
  }
  
  ElMessageBox.confirm('完成组卷后，试题篮将被清空，是否继续？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    savePaper()
    basket.value = []
    ElMessage.success('组卷已完成，可在"我的组卷"中查看')
  }).catch(() => {})
}

const openAnalyze = () => {
  ElMessage.info('试卷分析功能开发中...')
}

const downAnswerCard = () => {
  ElMessage.info('下载答题卡功能开发中...')
}

const setScore = () => {
  ElMessage.info('分值设置功能开发中...')
}

onMounted(() => {
  const sessionData = sessionStorage.getItem('paper_view_data')
  if (sessionData) {
    try {
      const data = JSON.parse(sessionData)
      isViewMode.value = true
      viewPaperName.value = data.paperName || '试卷'
      if (data.bookId) {
         adminApi.getMathBookQuestions(data.bookId).then(res => {
           if (res.code === 0 && res.data) {
             const questions = (Array.isArray(res.data) ? res.data : res.data.list || []).map(q => ({
               ...q,
               score: q.score || '5',
               area: q.area || 0
             }))
             basket.value = questions
             basket.value.forEach(q => getQuestionOptions(q))
             nextTick(() => {
               setTimeout(() => autoAdjustAllOptionLayouts(), 100)
             })
           } else {
             loadSessionQuestions(data)
           }
        }).catch(() => {
          loadSessionQuestions(data)
        })
      } else {
        loadSessionQuestions(data)
      }
    } catch (e) {
      console.error('加载试卷数据失败:', e)
      sessionStorage.removeItem('paper_view_data')
    }
  } else {
    isViewMode.value = false
    const savedBasket = localStorage.getItem('math_paper_basket')
    if (savedBasket) {
      try {
        basket.value = JSON.parse(savedBasket)
      } catch (e) {
        console.error('Failed to parse saved basket:', e)
      }
    }
  }
  
  const savedPaperForm = localStorage.getItem('paper_form')
  if (savedPaperForm) {
    try {
      Object.assign(paperForm.value, JSON.parse(savedPaperForm))
    } catch (e) {}
  }
  paperForm.value.showSource = true
  
  basket.value.forEach(q => {
    if (!q.score) q.score = '5'
    if (!q.area) q.area = 0
  })
  
  basket.value.forEach(q => getQuestionOptions(q))
  deletedQuestions.value.forEach(q => getQuestionOptions(q))
  
  nextTick(() => {
    setTimeout(() => {
      autoAdjustAllOptionLayouts()
    }, 100)
  })
})

const loadSessionQuestions = (data) => {
  basket.value = (data.questions || []).map(q => ({
    ...q,
    score: q.score || '5',
    area: q.area || 0
  }))
}

const exitViewMode = () => {
  sessionStorage.removeItem('paper_view_data')
  isViewMode.value = false
  const savedBasket = localStorage.getItem('math_paper_basket')
  if (savedBasket) {
    try {
      basket.value = JSON.parse(savedBasket)
    } catch (e) {}
  } else {
    basket.value = []
  }
  basket.value.forEach(q => getQuestionOptions(q))
}

const printPaper = () => {
  window.print()
}

watch(paperForm, (newForm) => {
  localStorage.setItem('paper_form', JSON.stringify(newForm))
}, { deep: true })
</script>

<style>
/* 查看模式控制栏 */
.view-mode-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  margin-bottom: 15px;
}
.view-mode-left {
  display: flex;
  align-items: center;
  gap: 15px;
}
.view-paper-name {
  font-size: 16px;
  font-weight: bold;
  color: #303133;
}
.view-mode-right {
  display: flex;
  gap: 10px;
}

/* 全局样式 - 确保页面可以滚动 */
body, html {
  overflow-y: auto !important;
  overflow-x: hidden !important;
}

.paper-marktag {
  text-align: center;
  font-size: 14pt;
  font-weight: bold;
  color: #c00;
  margin-bottom: 5mm;
  letter-spacing: 2px;
}

.paper-title {
  text-align: center;
  font-size: 22pt;
  font-weight: bold;
  font-family: "SimHei", "Heiti SC", sans-serif;
  margin-bottom: 3mm;
}

.paper-subtitle {
  text-align: center;
  font-size: 14pt;
  color: #666;
  margin-bottom: 3mm;
}

.paper-info, .paper-studentinfo {
  text-align: center;
  font-size: 11pt;
  color: #555;
  margin: 2mm 0;
}

.paper-score {
  margin: 5mm 0;
}

.score-table {
  width: 100%;
  border-collapse: collapse;
  margin: 0 auto;
}

.score-table td {
  border: 1px solid #333;
  padding: 3mm 5mm;
  text-align: center;
  font-size: 11pt;
}

.paper-notice {
  margin: 5mm 0;
  padding: 3mm;
  background: #f9f9f9;
  border: 1px solid #ddd;
}

.notice-title {
  font-weight: bold;
  margin-bottom: 2mm;
}

.notice-content {
  font-size: 11pt;
  line-height: 1.8;
}

.section-header {
  font-size: 14pt;
  font-weight: bold;
  margin: 5mm 0 3mm 0;
  padding-bottom: 2mm;
  border-bottom: 1px solid #333;
}

.section-cn {
  font-family: "SimHei", "Heiti SC", sans-serif;
}

.question-item {
  margin-bottom: 5mm;
}

.question-header {
  font-weight: bold;
  font-size: 11pt;
  margin-bottom: 1mm;
  font-family: "Times New Roman", serif;
}

.q-num {
  font-weight: bold;
  font-family: "Times New Roman", serif;
  margin-right: 2px;
}

.question-body {
  font-size: 11pt;
  line-height: 1.8;
}

.question-options {
  display: grid;
  gap: 1mm 5mm;
  margin: 2mm 0 2mm 5mm;
}

.option-item {
  font-size: 11pt;
  line-height: 1.8;
  font-family: "Times New Roman", "SimSun", serif;
}

.question-analysis {
  margin-top: 3mm;
  padding: 3mm;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-left: 3px solid #28a745;
  border-radius: 0 4px 4px 0;
  font-size: 10.5pt;
  line-height: 1.7;
}

.question-analysis-header {
  font-weight: bold;
  color: #28a745;
  margin-bottom: 2mm;
}

.question-analysis-content {
  color: #495057;
}

.question-analysis-content p {
  margin: 0.3em 0;
}

.question-analysis-content h3 {
  color: #007bff;
  font-size: 1em;
  margin: 0.5em 0 0.3em;
}

.question-analysis-content code {
  background: #e9ecef;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 0.9em;
  color: #c7254e;
}
</style>

<style scoped>
.make-paper-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20px;
  font-family: 'Microsoft YaHei', 'SimSun', sans-serif;
  overflow-y: auto;
  overflow-x: hidden;
}

.bread {
  padding: 10px 0;
  margin-bottom: 15px;
  font-size: 14px;
  color: #666;
}

.bread a {
  color: #008afb;
  text-decoration: none;
}

.bread a.active {
  color: #333;
  cursor: default;
}

.cleft {
  width: 320px;
}

.paper-content-wrapper {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.cr-center {
  width: 210mm;
  min-width: 210mm;
  max-width: 210mm;
}

.bg-fff {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.mb15 {
  margin-bottom: 15px;
}

.pv15 {
  padding-top: 15px;
  padding-bottom: 15px;
}

.pv20 {
  padding-top: 20px;
  padding-bottom: 20px;
}

.p20 {
  padding: 20px;
}

.mt10 {
  margin-top: 10px;
}

.mt20 {
  margin-top: 20px;
}

.mr5 {
  margin-right: 5px;
}

.mr10 {
  margin-right: 10px;
}

.mr20 {
  margin-right: 20px;
}

.ml5 {
  margin-left: 5px;
}

.fleft {
  float: left;
}

.fright {
  float: right;
}

.clearfix::after {
  content: '';
  display: table;
  clear: both;
}

.prelative {
  position: relative;
}

.tleft {
  text-align: left;
}

.tright {
  text-align: right;
}

.tcenter {
  text-align: center;
}

.c333 {
  color: #333;
}

.c666 {
  color: #666;
}

.c999 {
  color: #999;
}

.f12 {
  font-size: 12px;
}

.f16 {
  font-size: 16px;
}

.pl15 {
  padding-left: 15px;
}

.pb15 {
  padding-bottom: 15px;
}

.v10 {
  margin-top: 10px;
  margin-bottom: 10px;
}

.v15 {
  margin-top: 15px;
  margin-bottom: 15px;
}

.v20 {
  margin-top: 20px;
  margin-bottom: 20px;
}

.title-box {
  text-align: center;
}

.btn-new {
  display: inline-block;
  padding: 8px 20px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.3s;
}

.btn-blue {
  background: #008afb;
  color: #fff;
  border: 1px solid #008afb;
}

.btn-blue:hover {
  background: #0078d4;
  border-color: #0078d4;
}

.btn-empty {
  background: #fff;
  color: #008afb;
  border: 1px solid #008afb;
}

.btn-empty:hover {
  background: #f0f7ff;
}

.btn-fix-lg {
  padding: 10px 30px;
  font-size: 16px;
}

.feature-ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.feature-ul li {
  float: left;
  width: 33.33%;
  text-align: center;
}

.feature-ul li a {
  display: block;
  padding: 15px 10px;
  color: #666;
  text-decoration: none;
  transition: all 0.3s;
}

.feature-ul li a:hover {
  color: #008afb;
}

.feature-ul li a i {
  display: block;
  margin: 0 auto 10px;
  font-size: 24px;
}

.feature-ul li a p {
  margin: 0;
  font-size: 14px;
}

.paper-info {
  border-radius: 4px;
}

.new-paper-head {
  background: linear-gradient(135deg, #e6f7ff 0%, #fff 100%);
  padding: 12px 15px;
  border-bottom: 1px solid #e8e8e8;
}

.bdee8ff {
  border-left: 3px solid #1890ff;
  padding-left: 10px;
}

.c4680fe {
  color: #1890ff;
}

.blue-box-tlt {
  font-weight: bold;
}

.paper-cont {
  padding: 15px;
}

.radio-list-new,
.radio-list,
.checkbox-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.radio-list-new li,
.radio-list li,
.checkbox-list li {
  float: left;
  margin-right: 20px;
  margin-bottom: 10px;
}

.radio-list-new li span,
.radio-list li label,
.checkbox-list li label {
  font-size: 14px;
  color: #333;
  cursor: pointer;
}

.radio-list-new li em {
  font-style: normal;
  color: #1890ff;
  font-weight: bold;
}

.layout-btn {
  display: inline-block;
  padding: 3px 10px;
  margin: 0 5px;
  font-size: 13px;
  color: #666;
  background: #f5f5f5;
  border: 1px solid #d9d9d9;
  border-radius: 3px;
  text-decoration: none;
  transition: all 0.2s;
}

.layout-btn:hover {
  color: #1890ff;
  border-color: #1890ff;
}

.layout-btn.active {
  color: #fff;
  background: #1890ff;
  border-color: #1890ff;
}

.layout-separator {
  margin: 0 10px;
  color: #d9d9d9;
}

.layout-label {
  font-size: 13px;
  color: #666;
  margin-right: 5px;
  display: inline-block;
}

.layout-btn-small {
  display: inline-block !important;
  padding: 2px 6px !important;
  margin: 0 3px !important;
  font-size: 12px !important;
  color: #666 !important;
  background: #fff !important;
  border: 1px solid #d9d9d9 !important;
  border-radius: 3px !important;
  cursor: pointer !important;
  transition: all 0.2s !important;
  outline: none !important;
  line-height: 1.5 !important;
  text-align: center !important;
  vertical-align: middle !important;
}

.layout-btn-small:hover {
  color: #1890ff !important;
  border-color: #1890ff !important;
  background: #fff !important;
}

.layout-btn-small.active {
  color: #fff !important;
  background: #1890ff !important;
  border-color: #1890ff !important;
}

.cut-border {
  height: 1px;
  background: linear-gradient(to right, transparent, #e8e8e8, transparent);
  margin: 15px 0;
}

.tab-ctrl {
  border-bottom: 1px solid #e8e8e8;
  margin-bottom: 15px;
}

.tab-ctrl span.title {
  display: inline-block;
  padding: 8px 15px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all 0.3s;
}

.tab-ctrl span.title:hover {
  color: #1890ff;
}

.tab-ctrl span.title.active {
  color: #1890ff;
  border-bottom-color: #1890ff;
}

.hover_tips {
  visibility: hidden;
  opacity: 0;
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #333;
  color: #fff;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  transition: all 0.3s;
  z-index: 100;
}

.hover_tips i {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid #333;
}

.tab-ctrl span.title:hover .hover_tips {
  visibility: visible;
  opacity: 1;
}

.divSeqGroup {
  padding: 10px 0;
  border-bottom: 1px dashed #e8e8e8;
}

.gp-title {
  font-size: 14px;
  font-weight: bold;
}

.degree-sort {
  position: relative;
  display: inline-block;
  cursor: pointer;
}

.degree-sort ul {
  display: none;
  position: absolute;
  top: 100%;
  right: 0;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  padding: 5px 0;
  min-width: 120px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.degree-sort:hover ul {
  display: block;
}

.degree-sort ul li {
  display: block;
  padding: 5px 15px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  transition: all 0.3s;
}

.degree-sort ul li:hover {
  background: #f5f5f5;
  color: #1890ff;
}

.square-items {
  list-style: none;
  padding: 0;
  margin: 0;
}

.square-items li {
  display: inline-block;
  width: 30px;
  height: 30px;
  line-height: 30px;
  text-align: center;
  margin: 5px;
  background: #f5f5f5;
  border-radius: 4px;
  cursor: move;
  transition: all 0.3s;
}

.square-items li:hover {
  background: #e6f7ff;
}

.square-items li a {
  color: #333;
  text-decoration: none;
  font-size: 14px;
}

.btn {
  display: inline-block;
  padding: 6px 15px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.3s;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 13px;
}

.btn-empty {
  background: #fff;
  color: #666;
  border: 1px solid #d9d9d9;
}

.btn-empty:hover {
  color: #1890ff;
  border-color: #1890ff;
}

.tip {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 13px;
  color: #999;
  line-height: 1.8;
}

.exam {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.exam-seal {
  position: absolute;
  left: 0;
  top: 0;
  width: 58px;
  height: 100%;
  z-index: 10;
}

.exam-main {
  padding: 30px 40px;
}

.exam-head {
  text-align: center;
  margin-bottom: 30px;
}

.exam-marktag {
  font-size: 14px;
  font-weight: bold;
  color: #333;
  margin-bottom: 10px;
}

.exam-title {
  margin-bottom: 20px;
}

.exam-maintitle {
  font-size: 24px;
  font-weight: bold;
  color: #333;
  border: none;
  background: transparent;
  text-align: center;
  width: 100%;
  padding: 5px 0;
}

.exam-maintitle:focus {
  border-bottom: 1px dashed #1890ff;
  outline: none;
}

.exam-subtitle {
  font-size: 16px;
  color: #666;
  margin-top: 10px;
}

.exam-testinfo,
.exam-studentinfo {
  font-size: 14px;
  color: #666;
  margin: 15px 0;
}

.exam-score {
  margin: 20px 0;
}

.jcui-scoretable {
  border-collapse: collapse;
  margin: 0 auto;
}

.jcui-scoretable td {
  border: 1px solid #333;
  padding: 5px 10px;
  font-size: 14px;
}

.exam-notice {
  text-align: left;
  margin-top: 20px;
  padding: 15px;
  background: #f9f9f9;
  border-radius: 4px;
}

.exam-noticetip {
  font-weight: bold;
  margin-bottom: 10px;
}

.exam-noticetext {
  font-size: 14px;
  line-height: 1.8;
}

.exam-body {
  font-family: 'Times New Roman', 'SimSun', serif;
}

.exampart {
  margin-bottom: 30px;
}

.parthead {
  margin-bottom: 20px;
}

.partheadbox {
  padding: 15px;
  background: #f9f9f9;
  border-radius: 4px;
}

.partname {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  margin-bottom: 10px;
}

.partnote {
  font-size: 14px;
  color: #666;
}

.questype {
  margin-bottom: 20px;
}

.questypehead {
  position: relative;
  margin-bottom: 15px;
}

.questypeheadbox {
  padding: 10px 0;
}

.questypetitle {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.jcui-catescore {
  display: inline-block;
}

.markarea {
  position: absolute;
  right: 0;
  top: 0;
}

.part-ctrl {
  display: none;
}

.questypehead:hover .part-ctrl {
  display: block;
}

.part-ctrl span {
  display: inline-block;
  margin-left: 10px;
  padding: 3px 8px;
  font-size: 12px;
  color: #ff9800;
  cursor: pointer;
  border: 1px solid #ff9800;
  border-radius: 3px;
  transition: all 0.3s;
}

.part-ctrl span:hover {
  background: #ff9800;
  color: #fff;
}

.questypebody {
  padding-left: 30px;
}

.list-box {
  list-style: none;
  padding: 0;
  margin: 0;
}

.QUES_LI {
  position: relative;
  padding: 15px 0;
  border-bottom: 1px dashed #e8e8e8;
}

.QUES_LI:last-child {
  border-bottom: none;
}

.quesborder {
  border: none;
  padding: 15px 0;
  margin: 0;
  border-bottom: 1px dashed #e8e8e8;
}

.quesborder:last-child {
  border-bottom: none;
}

.pt1 {
  font-size: 15px;
  line-height: 1.8;
  color: #333;
  margin-bottom: 10px;
  font-family: 'Times New Roman', 'SimSun', serif;
}

.pt1 :deep(.katex) {
  font-family: 'Times New Roman', serif;
}

.pt1 :deep(.katex .mord),
.pt1 :deep(.katex .mbin),
.pt1 :deep(.katex .mrel),
.pt1 :deep(.katex .mopen),
.pt1 :deep(.katex .mclose),
.pt1 :deep(.katex .mpunct),
.pt1 :deep(.katex .minner) {
  font-family: 'Times New Roman', serif;
}

.pt1 :deep(.katex-display) {
  margin: 0.5em 0;
  text-align: center;
}

.qseq {
  font-weight: bold;
  color: #1890ff;
  margin-right: 5px;
}

.q-source {
  color: #1890ff;
  font-size: 13px;
  margin-right: 4px;
}

.ques-source {
  color: #1890ff;
  text-decoration: none;
  font-size: 13px;
  margin-right: 8px;
}

.ques-source:hover {
  text-decoration: underline;
}

.pt2 {
  margin-bottom: 10px;
}

.options-grid {
  display: grid;
  gap: 8px 20px;
  margin-bottom: 5px;
}

.option-item {
  font-size: 14px;
  line-height: 1.8;
  color: #333;
  padding: 2px 8px;
  font-family: 'Times New Roman', 'SimSun', serif;
}

.option-item label {
  cursor: pointer;
  display: inline-block;
}

.option-item label.s {
  color: #1890ff;
  font-weight: bold;
}

.option-item :deep(.katex) {
  font-family: 'Times New Roman', serif;
}

.option-item :deep(.katex .mord),
.option-item :deep(.katex .mbin),
.option-item :deep(.katex .mrel),
.option-item :deep(.katex .mopen),
.option-item :deep(.katex .mclose),
.option-item :deep(.katex .mpunct),
.option-item :deep(.katex .minner) {
  font-family: 'Times New Roman', serif;
}

.fieldtip {
  opacity: 0;
  transition: opacity 0.3s;
}

.QUES_LI:hover .fieldtip {
  opacity: 1;
}

.fieldtip-right {
  text-align: right;
  font-size: 13px;
}

.fieldtip-right a {
  color: #1890ff;
  text-decoration: none;
  margin: 0 5px;
}

.fieldtip-right a:hover {
  text-decoration: underline;
}

.input-data-score {
  width: 50px;
  text-align: center;
  border: 1px solid #d9d9d9;
  border-radius: 3px;
  padding: 2px 5px;
}

.input-data-area {
  width: 40px;
  text-align: center;
  border: 1px solid #d9d9d9;
  border-radius: 3px;
  padding: 2px 5px;
}

.icon {
  display: inline-block;
  width: 16px;
  height: 16px;
  vertical-align: middle;
}

.i-paper-del {
  background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ff4d4f"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>') no-repeat center center;
  background-size: contain;
}

.i-paper-sort {
  background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>') no-repeat center center;
  background-size: contain;
}

.i-orange-delete {
  background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ff9800"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>') no-repeat center center;
  background-size: contain;
}

.i-orange-up {
  background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ff9800"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>') no-repeat center center;
  background-size: contain;
}

.i-orange-down {
  background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ff9800"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>') no-repeat center center;
  background-size: contain;
}

.i-blue-down {
  background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%231890ff"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>') no-repeat center center;
  background-size: contain;
}

.p-new-icon {
  display: inline-block;
  width: 24px;
  height: 24px;
  vertical-align: middle;
  background: url('https://img.jyeoo.net/images/root/p-new-icon.png') no-repeat;
}

.p-new-icon-03-01 {
  background-position: 0 0;
}

.p-new-icon-03-02 {
  background-position: -24px 0;
}

.p-new-icon-03-10 {
  background-position: -48px 0;
}

.p-new-icon-05-01 {
  background-position: 0 -24px;
}

.p-new-icon-05-03 {
  background-position: -24px -24px;
}

.p-new-icon-05-10 {
  background-position: -48px -24px;
}

.p-new-icon-05-16 {
  background-position: -72px -24px;
}

.empty-basket {
  padding: 100px 0;
  text-align: center;
}

.custom-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: bold;
  margin: 0 2px;
}

.custom-tag.answer {
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
  color: #2e7d32;
  border: 1px solid #a5d6a7;
}

.custom-tag.analysis {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  color: #1565c0;
  border: 1px solid #90caf9;
}

.custom-tag.commentary {
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
  color: #e65100;
  border: 1px solid #ffcc80;
}

.custom-tag.note {
  background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
  color: #616161;
  font-style: italic;
  border: 1px solid #bdbdbd;
}

.custom-tag.step {
  background: linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%);
  color: #c2185b;
  border: 1px solid #f48fb1;
}

.ques-line {
  padding: 10px 0;
  border-bottom: 1px dashed #e8e8e8;
  color: #999;
}

.mr20 {
  margin-right: 20px;
}

.m10 {
  margin: 10px;
}

.pt10 {
  padding-top: 10px;
}

.ques-num-new {
  padding: 10px 0;
}

.square-items-new {
  padding-left: 15px;
}

.ui-sortable {
  min-height: 50px;
}

.groupPart_list {
  margin-bottom: 20px;
}

.orderid_1 {
  min-height: 100px;
}

.exam-parthead {
  padding: 15px;
  background: #f9f9f9;
  border-radius: 4px;
  margin-bottom: 20px;
}

.exam-catescore {
  display: inline-block;
}

.questypescore {
  width: 120px;
}

.exam.exporting .fieldtip,
.exam.exporting .part-ctrl,
.exam.exporting .markarea {
  display: none !important;
}

.exam.exporting .exam-marktag {
  display: block;
}

.exam.exporting .exam-body#divQues {
  column-gap: 20mm;
}

.exam.exporting input,
.exam.exporting textarea {
  border: none !important;
  background: transparent !important;
  outline: none !important;
  resize: none !important;
}

.exam.exporting .exam-maintitle,
.exam.exporting .subtitle-input,
.exam.exporting .testinfo-input,
.exam.exporting .studentinfo-input,
.exam.exporting .notice-textarea,
.exam.exporting .partname-input,
.exam.exporting .partnote-input,
.exam.exporting .marktag-input {
  border: none !important;
  background: transparent !important;
  outline: none !important;
}

/* 试卷统计 */
.action-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 15px;
  flex-wrap: wrap;
}
.action-divider {
  width: 1px;
  height: 30px;
  background: #e8e8e8;
  margin: 0 4px;
}
.action-icons {
  display: flex;
  align-items: center;
  gap: 4px;
}
.action-icon-link {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 4px 8px;
  font-size: 12px;
  color: #666;
  text-decoration: none;
  border-radius: 4px;
  transition: all 0.2s;
}
.action-icon-link:hover {
  background: #f5f5f5;
  color: #1890ff;
}
.action-icon-link span {
  vertical-align: middle;
}
.paper-stats {
  margin-top: 15px;
}
.stats-section {
  padding: 10px 15px;
  border-bottom: 1px solid #f0f0f0;
}
.stats-section:last-child {
  border-bottom: none;
}
.stats-title {
  font-size: 13px;
  font-weight: bold;
  color: #333;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.stats-avg {
  font-size: 12px;
  font-weight: normal;
  color: #999;
}
.stats-body {
  font-size: 13px;
}
.stats-row {
  display: flex;
  align-items: center;
  padding: 4px 0;
  gap: 8px;
}
.stats-label {
  flex: 1;
  color: #555;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stats-count {
  width: 40px;
  text-align: right;
  color: #1890ff;
  font-weight: bold;
}
.stats-score {
  width: 50px;
  text-align: right;
  color: #e67e22;
  font-weight: bold;
}
.stats-total {
  border-top: 1px dashed #e8e8e8;
  padding-top: 6px;
  margin-top: 2px;
}
.stats-total .stats-label {
  color: #333;
  font-weight: bold;
}
.stats-diff-row {
  gap: 6px;
}
.stats-diff-label {
  width: 30px;
  color: #555;
  text-align: left;
}
.stats-bar-bg {
  flex: 1;
  height: 12px;
  background: #f0f0f0;
  border-radius: 6px;
  overflow: hidden;
}
.stats-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #52c41a, #1890ff, #faad14, #ff4d4f);
  border-radius: 6px;
  transition: width 0.3s ease;
  min-width: 0;
}
.stats-diff-count {
  width: 35px;
  text-align: right;
  color: #666;
}
.stats-diff-percent {
  width: 35px;
  text-align: right;
  color: #999;
}
.stats-empty {
  text-align: center;
  color: #ccc;
  padding: 10px 0;
  font-size: 12px;
}
</style>
